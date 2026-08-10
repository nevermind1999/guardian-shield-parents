package com.guardianshield.parent;

import android.app.DownloadManager;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Environment;
import android.provider.Settings;
import com.getcapacitor.BridgeActivity;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

public class MainActivity extends BridgeActivity {

    // ID do download de atualização em andamento via UpdaterModule (DownloadManager),
    // usado pra reconhecer o aviso de conclusão no updateDownloadReceiver abaixo.
    private long pendingUpdateDownloadId = -1L;
    private BroadcastReceiver updateDownloadReceiver;

    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(UpdaterModule.class);
        super.onCreate(savedInstanceState);

        if (this.bridge != null && this.bridge.getWebView() != null) {
            this.bridge.getWebView().setDownloadListener((url, userAgent, contentDisposition, mimetype, contentLength) -> {
                try {
                    Intent intent = new Intent(Intent.ACTION_VIEW);
                    intent.setData(Uri.parse(url));
                    startActivity(intent);
                } catch (Exception e) {
                    e.printStackTrace();
                }
            });
        }

        // Avisa quando o APK de atualização (baixado pelo UpdaterModule) termina de
        // baixar, pra abrir a tela de instalação sozinho — nenhum navegador entra
        // nesse fluxo, então o botão voltar nunca sai do app por causa dele.
        updateDownloadReceiver = new BroadcastReceiver() {
            @Override
            public void onReceive(Context context, Intent intent) {
                long finishedId = intent.getLongExtra(DownloadManager.EXTRA_DOWNLOAD_ID, -1L);
                if (finishedId != -1L && finishedId == pendingUpdateDownloadId) {
                    promptInstallDownloadedUpdate();
                }
            }
        };
        IntentFilter downloadFilter = new IntentFilter(DownloadManager.ACTION_DOWNLOAD_COMPLETE);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            registerReceiver(updateDownloadReceiver, downloadFilter, Context.RECEIVER_EXPORTED);
        } else {
            registerReceiver(updateDownloadReceiver, downloadFilter);
        }
    }

    @Override
    public void onDestroy() {
        if (updateDownloadReceiver != null) {
            try {
                unregisterReceiver(updateDownloadReceiver);
            } catch (Exception ignored) {
                // já desregistrado (ex: onCreate nunca chegou a registrar)
            }
        }
        super.onDestroy();
    }

    /**
     * Abre a tela nativa "Instalar atualização?" pro APK que o UpdaterModule acabou
     * de baixar. Se o app ainda não tem permissão de instalar fontes desconhecidas,
     * manda o usuário conceder uma vez em vez de falhar silenciosamente — o próximo
     * toque em "Baixar e Atualizar" completa a instalação normalmente.
     */
    private void promptInstallDownloadedUpdate() {
        runOnUiThread(() -> {
            try {
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O && !getPackageManager().canRequestPackageInstalls()) {
                    Intent permissionIntent = new Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES, Uri.parse("package:" + getPackageName()));
                    permissionIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                    startActivity(permissionIntent);
                    return;
                }
                DownloadManager downloadManager = (DownloadManager) getSystemService(Context.DOWNLOAD_SERVICE);
                Uri downloadedFileUri = downloadManager.getUriForDownloadedFile(pendingUpdateDownloadId);
                if (downloadedFileUri == null) return;
                // getUriForDownloadedFile() já devolve um content:// gerenciado pelo próprio
                // DownloadManager (com permissão de leitura própria), então não precisa do
                // FileProvider do app aqui.
                Intent installIntent = new Intent(Intent.ACTION_VIEW);
                installIntent.setDataAndType(downloadedFileUri, "application/vnd.android.package-archive");
                installIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_GRANT_READ_URI_PERMISSION);
                startActivity(installIntent);
            } catch (Exception e) {
                e.printStackTrace();
            }
        });
    }

    @Override
    public void onBackPressed() {
        if (this.bridge != null && this.bridge.getWebView() != null && this.bridge.getWebView().canGoBack()) {
            this.bridge.getWebView().goBack();
        } else {
            this.bridge.triggerJSEvent("backButton", "document");
        }
    }

    /**
     * Baixa o APK de atualização via DownloadManager nativo — notificação de progresso
     * do próprio Android, sem abrir navegador nenhum — e abre a tela de instalação
     * sozinho ao concluir (ver updateDownloadReceiver/promptInstallDownloadedUpdate
     * em onCreate). Substitui o antigo window.open('_system'), que abria o navegador
     * como app separado e fazia o botão voltar sair do GuardianShield.
     */
    @CapacitorPlugin(name = "UpdaterModule")
    public static class UpdaterModule extends Plugin {
        @PluginMethod
        public void downloadAndInstall(PluginCall call) {
            String url = call.getString("url");
            String fileName = call.getString("fileName", "GuardianShield-atualizacao.apk");
            MainActivity activity = (MainActivity) getActivity();
            if (activity == null || url == null) {
                call.reject("URL de download ausente.");
                return;
            }
            try {
                DownloadManager.Request request = new DownloadManager.Request(Uri.parse(url));
                request.setTitle("GuardianShield");
                request.setDescription("Baixando atualização...");
                request.setNotificationVisibility(DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED);
                request.setDestinationInExternalFilesDir(activity, Environment.DIRECTORY_DOWNLOADS, fileName);
                request.setMimeType("application/vnd.android.package-archive");
                DownloadManager downloadManager = (DownloadManager) activity.getSystemService(Context.DOWNLOAD_SERVICE);
                activity.pendingUpdateDownloadId = downloadManager.enqueue(request);
                call.resolve();
            } catch (Exception e) {
                call.reject("Falha ao iniciar o download da atualização.", e);
            }
        }
    }
}
