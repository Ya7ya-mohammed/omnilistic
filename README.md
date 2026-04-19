# Omnilistic Cards 🎛️


## 📦 The Cards

### 1. Omnilistic Card (`custom:omnilistic-card`)
A highly advanced, unified control card with dynamic media support, built-in sliders, and custom glassmorphism styling.

![Omnilistic Card](img/omnilistic-card.jpg)

**Key Features:**
* **Dynamic Sliders:** Automatically cycles between Brightness, Color Temp, Hue, Saturation, and Volume based on the entity.
* **Smart Media:** Extracts album art to the background and reveals a sleek media playback deck.
* **Intelligent Animations:** State-based animations for fans, vacuums, lights, and media.
* **Dual-Entity Routing:** Display a sensor (e.g., temperature) while the slider controls a thermostat.

```yaml
type: custom:omnilistic-card
entity: light.living_room
# Fully configurable via the Visual Editor!
```

---

### 2. Omnilistic Speedtest Card (`custom:omnilistic-speedtest`)
A dedicated network monitoring card that visualizes your bandwidth data with beautifully animated arc gauges.

![Omnilistic Speedtest Card](img/Omnilistic-speedtest.jpg)

**Key Features:**
* **Smart Color Scaling:** Arcs dynamically shift colors based on live Ping/Down/Up quality thresholds.
* **Execution Scripting:** Tapping the card triggers a custom script to run your test while animating the speedometer icon.

```yaml
type: custom:omnilistic-speedtest
script_entity: script.run_speedtest
download_entity: sensor.speedtest_download
upload_entity: sensor.speedtest_upload
ping_entity: sensor.speedtest_ping
```

---

### 3. Minimal Purifier Card (`custom:minimal-purifier-card`)
A beautifully animated control interface engineered specifically for air purifiers (like the Xiaomi Air Purifier 4 Lite).

![Minimal Purifier Card Dark](img/minimal-purifier-card.jpg)
![Minimal Purifier Card Light](img/minimal-purifier-card-light.jpg)

**Key Features:**
* **Dynamic PM2.5 Engine:** Main ring and glow automatically shift colors from Green to Deep Red based on Air Quality.
* **Particle Physics:** Renders floating air particles that react directly to the live fan speed percentage.
* **Smart Controls:** Adaptive speed slider (only reveals on "Favorite" mode), plus Mode, Buzzer, and Lock toggles.
* **Filter Tracking:** Integrated monitoring for your filter's remaining life and estimated days.

```yaml
type: custom:minimal-purifier-card
power_entity: fan.air_purifier
pm_entity: sensor.air_purifier_pm2_5
mode_entity: fan.air_purifier
speed_entity: number.air_purifier_favorite_motor_speed
# Add remaining sensor/switch entities via the Visual Editor!
```
---
[![Open your Home Assistant instance and open a repository inside the Home Assistant Community Store.](https://my.home-assistant.io/badges/hacs_repository.svg)](https://my.home-assistant.io/redirect/hacs_repository/?owner=Ya7ya-mohammed&repository=omnilistic&category=plugin)

A collection of precision-engineered, custom-built UI cards for your Home Assistant dashboard. Designed with modern aesthetics, zero-latency controls, dynamic animations, and full Visual Editor support.


## 🚀 Installation 

**Option 1: The Easy Way** Click the **"Open in HACS"** badge above to automatically add this repository to your Home Assistant instance.

**Option 2: Manual HACS Install** 1. Go to **HACS** > **Frontend** > **⋮** > **Custom repositories**.
2. Add `https://github.com/Ya7ya-mohammed/omnilistic` as a **Dashboard** category.
3. Click **Download** and then refresh your browser cache (`Ctrl + F5`).

---
