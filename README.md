# mpremote-tools

Eine Visual Studio Code-Erweiterung zur einfachen Interaktion mit MicroPython-Geräten über das `mpremote`-Tool.

Diese Erweiterung bietet eine bequeme Möglichkeit, gängige `mpremote`-Befehle direkt aus dem VS Code-Editor auszuführen, was die Entwicklung für MicroPython-Boards wie Raspberry Pi Pico, ESP32 und ESP8266 vereinfacht.

## Features

- **Geräteverbindung:** Einfaches Verbinden und Trennen von Ihrem MicroPython-Gerät.
- **Dateiverwaltung:**
  - Dateien und Verzeichnisse auf dem Gerät auflisten.
  - Dateien vom Host-Computer auf das Gerät hochladen.
  - Dateien vom Gerät auf den Host-Computer herunterladen.
  - Dateien auf dem Gerät löschen.
- **Code-Ausführung:** Führen Sie das aktuell geöffnete Skript auf dem Gerät aus.
- **REPL-Integration:** Öffnen Sie eine REPL-Sitzung (Read-Eval-Print Loop) in einem integrierten VS Code-Terminal.
- **Geräte-Befehle:** Führen Sie Befehle wie Soft-Reset (`reset`) oder das Abrufen von Geräteinformationen (`devs`) aus.

## Anforderungen

Stellen Sie sicher, dass die folgenden Abhängigkeiten auf Ihrem System installiert sind:

1.  **Python 3.5+**: Muss installiert und zur `PATH`-Umgebungsvariable Ihres Systems hinzugefügt sein.
2.  **mpremote**: Das `mpremote`-Tool muss installiert sein. Sie können es über `pip` installieren:
    ```bash
    pip install mpremote
    ```

## Verwendung

1.  Schließen Sie Ihr MicroPython-Gerät an Ihren Computer an.
2.  Öffnen Sie die Befehlspalette in VS Code (`Ctrl+Shift+P` oder `Cmd+Shift+P` auf macOS).
3.  Geben Sie `mpremote` ein, um eine Liste der verfügbaren Befehle anzuzeigen.
4.  Wählen Sie den gewünschten Befehl aus, z. B.:
    - `mpremote: Connect to device`: Stellt eine Verbindung zum Gerät her (versucht, den Port automatisch zu erkennen).
    - `mpremote: List files on device`: Listet die Dateien im Stammverzeichnis des Geräts auf.
    - `mpremote: Upload active file to device`: Lädt die aktuell im Editor geöffnete Datei auf das Gerät hoch.
    - `mpremote: Open REPL`: Startet eine interaktive REPL-Sitzung.

## Erweiterungseinstellungen

Diese Erweiterung fügt die folgenden Einstellungen zu Ihren VS Code-Einstellungen hinzu:

- `mpremote.port`: Geben Sie den seriellen Port für Ihr Gerät an (z. B. `COM3` unter Windows oder `/dev/ttyUSB0` unter Linux). Wenn leer, versucht `mpremote` den Port automatisch zu finden.
- `mpremote.baudrate`: Die Baudrate für die serielle Kommunikation. Der Standardwert ist `115200`.

## Bekannte Probleme

Derzeit sind keine bekannten Probleme vorhanden. Wenn Sie auf einen Fehler stoßen, erstellen Sie bitte ein Issue im [GitHub-Repository](https://github.com/your-repo/mpremote-tools).

## Release Notes

### 1.0.0

- Erste Veröffentlichung von `mpremote-tools`.
- Grundlegende Funktionen für Geräteverbindung, Dateiverwaltung und REPL-Integration hinzugefügt.

---

**Viel Spaß beim Entwickeln mit MicroPython in VS Code!**
