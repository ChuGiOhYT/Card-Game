package com.chugioh.aeternum;

import android.graphics.Bitmap;
import android.os.Bundle;
import android.view.WindowManager;
import android.webkit.WebSettings;
import android.webkit.WebView;

import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsCompat;
import androidx.core.view.WindowInsetsControllerCompat;

import com.getcapacitor.BridgeActivity;
import com.getcapacitor.BridgeWebChromeClient;

/**
 * AETERNUM en el teléfono. El juego es el mismo HTML que el .exe; aquí solo se
 * ajusta el WebView para que se comporte como una mesa de juego:
 *  - «viewport ancho»: la página dice de qué ancho la diseñamos (js/plataforma.js)
 *    y el WebView la escala para que quepa entera en la pantalla;
 *  - el audio y los vídeos suenan sin esperar un toque (música, narrador);
 *  - pantalla completa, sin barras del sistema (se asoman deslizando);
 *  - la pantalla no se apaga en mitad de un duelo;
 *  - sin el cuadro negro con la flecha de «reproducir» que Android pinta en
 *    cada vídeo antes de su primer fotograma (getDefaultVideoPoster).
 */
public class MainActivity extends BridgeActivity {

    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
        if (getBridge() != null) {
            WebView web = getBridge().getWebView();
            WebSettings s = web.getSettings();
            s.setUseWideViewPort(true);
            s.setLoadWithOverviewMode(true);
            s.setMediaPlaybackRequiresUserGesture(false);
            s.setSupportZoom(false);
            s.setBuiltInZoomControls(false);
            s.setDisplayZoomControls(false);
            // El mismo cliente de Capacitor (permisos, archivos…), pero con un
            // póster transparente de 1 px en vez del de «reproducir».
            web.setWebChromeClient(new BridgeWebChromeClient(getBridge()) {
                @Override
                public Bitmap getDefaultVideoPoster() {
                    return Bitmap.createBitmap(1, 1, Bitmap.Config.ARGB_8888);
                }
            });
        }
        pantallaCompleta();
    }

    @Override
    public void onWindowFocusChanged(boolean hasFocus) {
        super.onWindowFocusChanged(hasFocus);
        // Al volver de otra app (o tras un aviso del sistema) las barras reaparecen.
        if (hasFocus) pantallaCompleta();
    }

    private void pantallaCompleta() {
        WindowCompat.setDecorFitsSystemWindows(getWindow(), false);
        WindowInsetsControllerCompat c = WindowCompat.getInsetsController(getWindow(), getWindow().getDecorView());
        c.hide(WindowInsetsCompat.Type.systemBars());
        c.setSystemBarsBehavior(WindowInsetsControllerCompat.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE);
    }
}
