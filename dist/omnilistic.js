// ============================================================================
// OMNILISTIC CARD - MASTER ARCHITECTURE
// ============================================================================

class OmnilisticCard extends HTMLElement {
  
  // =======================================================
  // 1. INITIALIZATION & STATE MANAGEMENT
  // =======================================================
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this.sliderMode = 'brightness';
    this.availableModes = ['brightness'];
    this._isSliding = false;
    this._lastChangeTime = 0;
  }

  static getConfigElement() { 
    return document.createElement("omnilistic-card-editor"); 
  }
  
  static getStubConfig(hass) { 
    let entity = "light.dummy";
    if (hass && hass.states) {
      const allowedDomains = ["light", "switch", "media_player", "climate", "cover", "fan", "vacuum", "lock", "sensor", "binary_sensor", "button", "number", "input_number", "select", "person"];
      const validEntities = Object.keys(hass.states).filter(e => {
        const domain = e.split('.')[0];
        return allowedDomains.includes(domain) && !e.includes('browser_mod');
      });
      if (validEntities.length > 0) entity = validEntities[0];
    }
    return { 
      entity: entity, 
      use_secondary_entity: false,
      tap_action: { action: "toggle" }, 
      hold_action: { action: "more-info" }, 
      icon_tap_action: { action: "none" },
      enable_haptics: false, 
      haptic_type: "light"
    }; 
  }

  setConfig(config) {
    if (!config.entity) {
      this.config = { ...config };
      return;
    }
    this.config = { 
      tap_action: { action: 'toggle' }, 
      hold_action: { action: 'more-info' }, 
      icon_tap_action: { action: 'none' },
      enable_haptics: false, 
      haptic_type: 'light', 
      use_secondary_entity: false,
      ...config 
    };
  }

  set hass(hass) {
    this._hass = hass;
    if (!this.config || !this.config.entity) return;

    const targetSecondary = (this.config.use_secondary_entity && this.config.secondary_entity) ? this.config.secondary_entity : this.config.entity;
    
    // Missing Entity Protection
    let stateObj = hass.states[this.config.entity];
    let secondaryStateObj = hass.states[targetSecondary];

    if (!stateObj) {
      stateObj = { state: 'unavailable', __isMissing: true, attributes: { friendly_name: this.config.entity, icon: 'mdi:help-circle-outline' }, entity_id: this.config.entity };
    }
    if (!secondaryStateObj) {
      secondaryStateObj = { state: 'unavailable', __isMissing: true, attributes: {}, entity_id: targetSecondary };
    }

    if (!this.content) {
      this.innerHTML = '';
      this.renderTemplate();
      this.bindActions();
      this.bindMediaActions();
    }

    this.updateData(stateObj, secondaryStateObj);
  }

  fireHaptic(typeOverride) {
    if (this.config.enable_haptics) {
      const hapticType = typeOverride || this.config.haptic_type || 'light';
      const event = new Event('haptic', { bubbles: true, composed: true });
      event.detail = hapticType;
      this.dispatchEvent(event);
    }
  }

  // =======================================================
  // 2. HTML TEMPLATE & CSS ENGINE
  // =======================================================
  renderTemplate() {
    this.shadowRoot.innerHTML = `
      <style>
        :host {
          display: block;
          width: 100%;
          height: 100%; 
          font-family: var(--primary-font-family, inherit);
        }
        ha-card {
          height: 100%; 
          min-height: 110px; 
          position: relative; 
          box-sizing: border-box;
          /* Flawlessly adopts native HA backgrounds when off */
          background: var(--card-custom-bg, var(--ha-card-background, var(--card-background-color, #fff)));
          backdrop-filter: blur(var(--card-backdrop-blur, 25px)) saturate(200%);
          -webkit-backdrop-filter: blur(var(--card-backdrop-blur, 25px)) saturate(200%);
          transition: background 0.3s ease, border-radius 0.3s ease, box-shadow 0.3s ease;
          cursor: pointer;
          overflow: hidden;
          -webkit-tap-highlight-color: transparent;
        }

        /* Dedicated Album Art Layer */
        .bg-layer {
          position: absolute;
          inset: 0;
          background: var(--card-bg-overlay, none), var(--card-bg-image, none);
          background-size: cover;
          background-position: center;
          opacity: var(--bg-img-opacity, 1);
          z-index: 0;
          pointer-events: none;
          border-radius: inherit;
          transition: opacity 0.3s ease;
        }
        
        /* The Shield Wrapper that prevents the Ripple from firing on scrolls */
        .ripple-shield {
          position: absolute;
          inset: 0;
          pointer-events: none;
          z-index: 1;
          border-radius: inherit;
          overflow: hidden;
        }

        /* Native Home Assistant MWC Ripple */
        #ripple {
          /* Color and Opacity are dynamically set by JS on the ha-card */
        }
        
        .card-content-wrapper {
          display: flex;
          flex-direction: column;
          justify-content: flex-start;
          height: 100%;
          padding: 16px 12px;
          box-sizing: border-box;
          position: relative;
          z-index: 2;
        }

        .unavailable { opacity: 0.6; }
        
        /* Advanced Animations Engine */
        @keyframes spin { 100% { transform: rotate(360deg); } }
        @keyframes pulse { 0%, 100% { opacity: 1; transform: scale(1); } 50% { opacity: 0.6; transform: scale(0.92); } }
        @keyframes bounce { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-3px); } }
        @keyframes bright-idea { 
          0%, 100% { filter: drop-shadow(0 0 2px transparent); transform: scale(1); } 
          50% { filter: drop-shadow(0 0 10px currentColor); transform: scale(1.1); } 
        }
        
        .anim-spin { animation: spin 2s linear infinite; }
        .anim-pulse { animation: pulse 2.5s ease-in-out infinite; }
        .anim-bounce { animation: bounce 2s ease-in-out infinite; }
        .anim-bright-idea { animation: bright-idea 2s ease-in-out infinite; }

        /* Fixed Spatial Layout Architecture */
        .middle-section {
          position: absolute;
          top: 50%;
          transform: translateY(-50%); 
          left: 12px;
          right: 12px;
          display: flex;
          align-items: center;
          gap: 4px; 
          width: calc(100% - 24px);
        }
        
        .middle-section.layout-center {
          flex-direction: column;
          justify-content: center;
          text-align: center;
          top: 40%; 
        }

        .icon-container {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 36px;
          height: 36px;
          position: relative; 
          flex-shrink: 0;
          border-radius: 50%;
          transition: background 0.2s;
        }
        .icon-container.has-action {
          cursor: pointer;
        }
        .icon-container ha-icon { color: var(--primary-text-color, #000); }
        
        .unavailable-badge {
          position: absolute;
          top: -4px;
          right: -4px;
          display: flex;
          align-items: center;
          justify-content: center;
          opacity: 0;
          pointer-events: none;
          z-index: 2;
          transition: opacity 0.3s ease;
          border-radius: 50%;
        }
        .unavailable-badge ha-icon {
          color: var(--error-color, #db4437);
          --mdc-icon-size: 16px;
          filter: drop-shadow(0px 2px 4px rgba(0,0,0,0.15));
        }
        ha-card.unavailable .unavailable-badge { opacity: 1; }

        .text-container {
          display: flex;
          flex-direction: column;
          justify-content: center;
          min-width: 0; 
          flex: 1;
          width: 100%;
        }
        
        .layout-center .text-container {
          align-items: center;
          text-align: center;
        }

        /* Native Theme Typography Adoption */
        .entity-name, .attributes {
          text-transform: var(--custom-text-transform, none);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          width: 100%;
          color: var(--primary-text-color);
        }
        .entity-name {
          font-size: var(--custom-font-size, var(--paper-font-subhead_-_font-size, 16px)); 
          font-weight: var(--custom-title-font-weight, 500);
          line-height: 1.2;
          margin-bottom: 2px; 
        }
        .attributes {
          font-size: calc(var(--custom-font-size, var(--paper-font-body1_-_font-size, 14px)) * 0.85); 
          font-weight: var(--custom-subtitle-font-weight, 400);
          line-height: 1.2;
          margin-top: 0;
          opacity: 0.8;
        }

        /* Fixed Footer Controls */
        .controls-container {
          position: absolute;
          bottom: 4px; 
          left: var(--controls-inset, 12px);
          width: calc(100% - (var(--controls-inset, 12px) * 2));
          height: 32px; 
          display: flex;
          flex-wrap: nowrap;
          align-items: center;
          gap: 8px;
          opacity: 1;
          transition: opacity 0.2s, left 0.3s, width 0.3s;
          box-sizing: border-box;
        }
        .controls-container.hidden {
          opacity: 0;
          pointer-events: none;
        }

        /* Standard Slider */
        input[type=range] {
          -webkit-appearance: none;
          flex: 1 1 0%; 
          min-width: 0; 
          width: 100%;
          height: 14px;
          border-radius: 7px;
          outline: none;
          margin: 0;
          box-shadow: rgba(0, 0, 0, 0.12) 0px 1px 3px, rgba(0, 0, 0, 0.24) 0px 1px 2px;
          transition: opacity 0.2s;
        }
        input[type=range]::-webkit-slider-thumb {
          -webkit-appearance: none;
          width: 14px;
          height: 14px;
          border-radius: 50%;
          background: #000000;
          /* Removed shadow from thumb to prevent sharp edge artifacts */
          cursor: pointer;
        }

        /* Responsive Media Player Controls - Left Aligned */
        .media-controls-wrapper {
          display: none;
          flex: 1 1 0%;
          min-width: 0; 
          align-items: center;
          justify-content: flex-start;
          gap: 12px; 
          padding: 0 calc(var(--controls-inset, 12px) * 0.4);
        }
        .media-controls-wrapper.active {
          display: flex;
        }
        .media-btn {
          background: none;
          border: none;
          color: var(--primary-text-color);
          cursor: pointer;
          padding: 4px;
          margin: 0;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: background 0.2s, opacity 0.2s;
          position: relative;
          z-index: 5;
          flex: 0 1 auto; 
          min-width: 0;
        }
        .media-btn:hover { background: rgba(0,0,0,0.1); }
        .media-btn ha-icon { --mdc-icon-size: 20px; }

        /* Universal Mode Button - Right Anchored */
        .mode-button {
          height: 32px; 
          width: 32px;
          min-width: 32px;
          max-width: 32px;
          flex: 0 0 32px; 
          border-radius: 12px; 
          border: none;
          background: rgba(0,0,0,0.05); 
          color: var(--primary-text-color, #000);
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 0px;
          margin: 0px;
          box-sizing: border-box;
          position: relative;
          z-index: 5;
        }
        .mode-button ha-icon {
          width: 16px; 
          height: 16px; 
          display: flex;
          align-items: center;
          justify-content: center;
          --mdc-icon-size: 16px; 
          margin: 0;
          padding: 0;
        }
      </style>
      
      <ha-card id="card">
        
        <div class="bg-layer" id="bg-layer"></div>

        <div class="ripple-shield">
          <mwc-ripple id="ripple"></mwc-ripple>
        </div>
        
        <div class="card-content-wrapper">
          <div class="middle-section" id="mid-section">
            <div class="icon-container" id="icon-wrapper">
              <ha-icon id="icon"></ha-icon>
              <div class="unavailable-badge" id="unavail-badge">
                <ha-icon icon="mdi:alert-circle"></ha-icon>
              </div>
            </div>
            <div class="text-container">
              <div class="entity-name" id="name"></div>
              <div class="attributes" id="attrs"></div>
            </div>
          </div>
          <div class="controls-container" id="controls">
            
            <input type="range" id="slider" min="0" max="100" value="0">
            
            <div class="media-controls-wrapper" id="media-controls">
              <button class="media-btn" id="btn-shuffle"><ha-icon icon="mdi:shuffle"></ha-icon></button>
              <button class="media-btn" id="btn-prev"><ha-icon icon="mdi:skip-previous"></ha-icon></button>
              <button class="media-btn" id="btn-play"><ha-icon id="play-icon" icon="mdi:play"></ha-icon></button>
              <button class="media-btn" id="btn-next"><ha-icon icon="mdi:skip-next"></ha-icon></button>
            </div>

            <button class="mode-button" id="mode-btn"><ha-icon id="mode-icon" icon="mdi:brightness-6"></ha-icon></button>
          </div>
        </div>
      </ha-card>
    `;
    this.content = true;

    // Inject custom slowed down speed (800ms) into the native MWC element's shadow root
    customElements.whenDefined('mwc-ripple').then(() => {
      const ripple = this.shadowRoot.getElementById('ripple');
      if (ripple) {
        ripple.updateComplete?.then(() => {
          if (ripple.shadowRoot && !ripple.shadowRoot.getElementById('custom-speed')) {
            const style = document.createElement('style');
            style.id = 'custom-speed';
            style.textContent = `
              .mdc-ripple-surface::after, 
              .mdc-ripple-surface::before { 
                transition-duration: 800ms !important; 
              }
            `;
            ripple.shadowRoot.appendChild(style);
          }
        });
      }
    });

    const modeBtn = this.shadowRoot.getElementById('mode-btn');
    modeBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      this.fireHaptic('selection');
      if (this.availableModes.length <= 1) return;
      
      let currentIndex = this.availableModes.indexOf(this.sliderMode);
      this.sliderMode = this.availableModes[(currentIndex + 1) % this.availableModes.length];
      
      const targetSecondary = (this.config.use_secondary_entity && this.config.secondary_entity) ? this.config.secondary_entity : this.config.entity;
      this.updateData(this._hass.states[this.config.entity], this._hass.states[targetSecondary], true);
    });

    const slider = this.shadowRoot.getElementById('slider');
    slider.addEventListener('input', (e) => {
      e.stopPropagation();
      this._isSliding = true;
      this.updateSliderBackground(parseFloat(e.target.value));
    });

    slider.addEventListener('change', (e) => {
      e.stopPropagation();
      this.fireHaptic('light');
      this._isSliding = false;
      this._lastChangeTime = Date.now();
      
      const val = parseFloat(e.target.value);
      
      // Dynamic Smart Routing for Volume
      if (this.sliderMode === 'media_volume') {
        let volEntity = this.config.entity;
        if (this.config.use_secondary_entity && this.config.secondary_entity) {
            const secDom = this.config.secondary_entity.split('.')[0];
            const primDom = this.config.entity.split('.')[0];
            if (primDom === 'media_player' && (secDom === 'number' || secDom === 'input_number')) {
                volEntity = this.config.secondary_entity;
            } else if (secDom === 'media_player') {
                volEntity = this.config.secondary_entity;
            }
        }
        
        if (volEntity.startsWith('number.') || volEntity.startsWith('input_number.')) {
          this._hass.callService(volEntity.split('.')[0], 'set_value', { entity_id: volEntity, value: val });
        } else {
          this._hass.callService('media_player', 'volume_set', { entity_id: volEntity, volume_level: val / 100 });
        }
        return;
      }
      
      const targetEntity = (this.config.use_secondary_entity && this.config.secondary_entity) ? this.config.secondary_entity : this.config.entity;

      if (this.sliderMode === 'number') {
        this._hass.callService('number', 'set_value', { entity_id: targetEntity, value: val });
        return;
      }

      let serviceData = { entity_id: targetEntity };
      if (this.sliderMode === 'brightness') serviceData.brightness = Math.round((val / 100) * 255);
      if (this.sliderMode === 'hue') serviceData.hs_color = [val, this.currentSat || 100];
      if (this.sliderMode === 'saturation') serviceData.hs_color = [this.currentHue || 0, val];
      if (this.sliderMode === 'color_temp') serviceData.color_temp_kelvin = val;
      this._hass.callService('light', 'turn_on', serviceData);
    });
  }

  // =======================================================
  // 3. UI RENDERING & LOGIC
  // =======================================================
  updateSliderBackground(value) {
    const slider = this.shadowRoot.getElementById('slider');
    if (this.sliderMode === 'brightness' || this.sliderMode === 'number' || this.sliderMode === 'media_volume') {
      slider.style.background = 'linear-gradient(90deg, rgba(255,255,255,0.3) 0%, rgba(255,255,255,1) 100%)';
    } else if (this.sliderMode === 'hue') {
      slider.style.background = 'linear-gradient(to right, #ff0000 0%, #ffff00 17%, #00ff00 33%, #00ffff 50%, #0000ff 67%, #ff00ff 83%, #ff0000 100%)';
    } else if (this.sliderMode === 'saturation') {
      const hueColor = `hsl(${this.currentHue || 0}, 100%, 50%)`;
      slider.style.background = `linear-gradient(to right, #ffffff, ${hueColor})`;
    } else if (this.sliderMode === 'color_temp') {
      slider.style.background = 'linear-gradient(to right, #ffb366, #ffffff, #a6caf0)';
    }
  }

  updateData(stateObj, secondaryStateObj, forceUpdate = false) {
    const card = this.shadowRoot.getElementById('card');
    const iconWrapper = this.shadowRoot.getElementById('icon-wrapper');
    const iconEl = this.shadowRoot.getElementById('icon');
    const nameEl = this.shadowRoot.getElementById('name');
    const attrsEl = this.shadowRoot.getElementById('attrs');
    const controlsEl = this.shadowRoot.getElementById('controls');
    const slider = this.shadowRoot.getElementById('slider');
    const modeBtn = this.shadowRoot.getElementById('mode-btn');
    const modeIcon = this.shadowRoot.getElementById('mode-icon');
    const midSection = this.shadowRoot.getElementById('mid-section');
    const mediaControls = this.shadowRoot.getElementById('media-controls');

    const isOff = stateObj.state === 'off';
    const isUnavailable = stateObj.state === 'unavailable';
    const isSecUnavailable = secondaryStateObj ? secondaryStateObj.state === 'unavailable' : false;

    const styling = this.config.styling || {};
    
    // Dynamic Action Cursor Management
    const hasTapAction = this.config.tap_action && this.config.tap_action.action !== 'none';
    const hasHoldAction = this.config.hold_action && this.config.hold_action.action !== 'none';
    card.style.cursor = (!hasTapAction && !hasHoldAction) ? 'default' : 'pointer';

    if (styling.center_layout) midSection.classList.add('layout-center');
    else midSection.classList.remove('layout-center');

    // Visibility Toggles
    iconWrapper.style.display = styling.hide_icon ? 'none' : 'flex';
    nameEl.style.display = styling.hide_name ? 'none' : 'block';
    attrsEl.style.display = styling.hide_state ? 'none' : 'block';

    if (this.config.icon_tap_action && this.config.icon_tap_action.action !== 'none') {
        iconWrapper.classList.add('has-action');
    } else {
        iconWrapper.classList.remove('has-action');
    }

    // Split Typography Logic
    if (styling.title_font_size) card.style.setProperty('--custom-font-size', `${styling.title_font_size}px`);
    else card.style.removeProperty('--custom-font-size');
    
    if (styling.title_font_weight) card.style.setProperty('--custom-title-font-weight', styling.title_font_weight);
    else card.style.removeProperty('--custom-title-font-weight');

    if (styling.subtitle_font_weight) card.style.setProperty('--custom-subtitle-font-weight', styling.subtitle_font_weight);
    else card.style.removeProperty('--custom-subtitle-font-weight');

    card.style.setProperty('--custom-text-transform', styling.title_transform || 'none');
    
    const bdBlur = styling.backdrop_blur !== undefined ? styling.backdrop_blur : 25;
    card.style.setProperty('--card-backdrop-blur', `${bdBlur}px`);
    
    if (styling.border_radius !== undefined) {
      card.style.borderRadius = `${styling.border_radius}px`;
      const safeInset = Math.max(12, styling.border_radius * 0.6); 
      card.style.setProperty('--controls-inset', `${safeInset}px`);
    } else {
      card.style.removeProperty('border-radius'); // Properly inherits HA Native Theme rounding
      card.style.setProperty('--controls-inset', '12px');
    }

    const shOp = styling.shadow_opacity !== undefined ? styling.shadow_opacity : 24;
    const shSize = styling.shadow_size !== undefined ? styling.shadow_size : 3;
    const shColor = styling.shadow_color || '#000000';
    
    if (isUnavailable || isOff) {
      card.style.setProperty('box-shadow', 'none', 'important');
    } else {
      const shadowString = `color-mix(in srgb, ${shColor} ${shOp/2}%, transparent) 0px 1px ${shSize}px, color-mix(in srgb, ${shColor} ${shOp}%, transparent) 0px 1px ${Math.max(1, shSize - 1)}px`;
      card.style.setProperty('box-shadow', shadowString, 'important');
    }

    const bgOp = styling.bg_opacity !== undefined ? styling.bg_opacity : 75;
    
    // Bulletproof Entity Name Resolution
    let defaultName = stateObj.attributes.friendly_name || stateObj.entity_id || 'Unknown';
    if (this.config.name !== undefined && this.config.name.trim() !== '') {
        defaultName = this.config.name;
    }
    nameEl.innerText = defaultName;

    const domain = this.config.entity.split('.')[0];
    const secDomain = secondaryStateObj ? secondaryStateObj.entity_id.split('.')[0] : domain;
    
    const domainIcons = {
      light: 'mdi:lightbulb', switch: 'mdi:toggle-switch-variant', sensor: 'mdi:eye-outline', binary_sensor: 'mdi:radiobox-marked',
      media_player: 'mdi:speaker', climate: 'mdi:thermostat', person: 'mdi:account', cover: 'mdi:window-shutter',
      fan: 'mdi:fan', vacuum: 'mdi:robot-vacuum', lock: 'mdi:lock', script: 'mdi:script-text', scene: 'mdi:palette-outline',
      automation: 'mdi:robot', button: 'mdi:gesture-tap-button', input_boolean: 'mdi:toggle-switch',
      number: 'mdi:numeric', select: 'mdi:format-list-bulleted'
    };

    let activeIcon = stateObj.attributes.icon || domainIcons[domain] || 'mdi:bookmark';
    if (this.config.icon) activeIcon = this.config.icon;

    if (isOff || isUnavailable) {
      if (this.config.icon_off) activeIcon = this.config.icon_off;
      else if (this.config.icon) {
         if (activeIcon.endsWith('-on')) activeIcon = activeIcon.replace('-on', '-off');
         else if (!activeIcon.endsWith('-outline')) activeIcon = activeIcon + '-off';
      } else {
        const offMap = {
          'mdi:lightbulb': 'mdi:lightbulb-off', 'mdi:flash': 'mdi:flash-off', 'mdi:fan': 'mdi:fan-off',
          'mdi:toggle-switch': 'mdi:toggle-switch-off', 'mdi:toggle-switch-variant': 'mdi:toggle-switch-variant-off',
          'mdi:speaker': 'mdi:speaker-off', 'mdi:television': 'mdi:television-off'
        };
        if (offMap[activeIcon]) activeIcon = offMap[activeIcon];
      }
    }
    iconEl.icon = activeIcon;

    iconEl.classList.remove('anim-spin', 'anim-pulse', 'anim-pop', 'anim-bounce', 'anim-bright-idea');
    if (styling.enable_animations && !isOff && !isUnavailable) {
      if (domain === 'fan' || activeIcon.includes('fan')) iconEl.classList.add('anim-spin');
      else if (domain === 'media_player') iconEl.classList.add('anim-pulse');
      else if (domain === 'vacuum') iconEl.classList.add('anim-bounce');
      else if (domain === 'light' || domain === 'switch' || domain === 'input_boolean' || activeIcon.includes('bulb')) iconEl.classList.add('anim-bright-idea');
    }

    // Intelligent Dual-Entity Album Art Hunter
    let entityPic = null;
    if (domain === 'media_player' && stateObj.attributes.entity_picture) {
        entityPic = stateObj.attributes.entity_picture;
    } else if (secDomain === 'media_player' && secondaryStateObj?.attributes?.entity_picture) {
        entityPic = secondaryStateObj.attributes.entity_picture;
    }

    const hasAlbumArt = entityPic && styling.dynamic_album_art !== false;

    if (hasAlbumArt) {
      card.style.setProperty('--card-bg-image', `url('${entityPic}')`);
      card.style.setProperty('--card-bg-overlay', `linear-gradient(to top, rgba(0,0,0,0.8) 0%, rgba(0,0,0,0.2) 50%, rgba(0,0,0,0.6) 100%)`);
      card.style.setProperty('--bg-img-opacity', (bgOp / 100).toString());
      card.style.setProperty('--primary-text-color', '#ffffff');
    } else {
      card.style.setProperty('--card-bg-image', 'none');
      card.style.setProperty('--card-bg-overlay', 'none');
      card.style.setProperty('--bg-img-opacity', '1');
      card.style.removeProperty('--primary-text-color');
    }

    const getAttr = (attrName, sObj, mObj) => {
      if (!attrName || attrName === 'none') return null; 
      if (attrName === 'state') return { val: (sObj || mObj).state, obj: (sObj || mObj) };
      if (sObj && sObj.attributes[attrName] !== undefined) return { val: sObj.attributes[attrName], obj: sObj };
      if (mObj && mObj.attributes[attrName] !== undefined) return { val: mObj.attributes[attrName], obj: mObj };
      return null;
    };

    const formatAttr = (attrName, attrData) => {
      if (!attrData || attrData.val === undefined || attrData.val === null) return '';
      const val = attrData.val;
      if (attrName === 'brightness') return `${Math.round((val / 255) * 100)}%`;
      if (!isNaN(parseFloat(val)) && isFinite(val)) {
        let unit = attrData.obj?.attributes?.unit_of_measurement;
        if (!unit && (attrData.obj?.entity_id.startsWith('number.') || this.sliderMode === 'number')) unit = '%';
        if (unit) return `${Math.round(val * 10)/10} ${unit}`;
      }
      return val;
    };

    let attrText = stateObj.__isMissing ? 'Entity Not Found' : isUnavailable ? 'Unavailable' : isOff ? 'Off' : stateObj.state;
    if (!isOff && !isUnavailable && !stateObj.__isMissing) {
      const raw1 = getAttr(this.config.attribute_1, secondaryStateObj, stateObj);
      const raw2 = getAttr(this.config.attribute_2, secondaryStateObj, stateObj);
      const a1 = raw1 ? formatAttr(this.config.attribute_1, raw1) : (this.config.attribute_1 === 'none' ? '' : stateObj.state);
      const a2 = raw2 ? formatAttr(this.config.attribute_2, raw2) : '';
      attrText = (a1 && a2) ? `${a1} • ${a2}` : (a1 || a2 || '');
    }
    attrsEl.innerText = attrText;

    // --- Intelligent Media & Number Mode Processing ---
    this.availableModes = [];
    const isPrimaryMedia = domain === 'media_player';
    const isSecMedia = secDomain === 'media_player';
    
    if (isPrimaryMedia || isSecMedia) {
        this.availableModes.push('media_controls');
    }

    if (secDomain === 'light') {
        const supported = secondaryStateObj?.attributes?.supported_color_modes || [];
        if (supported.includes('hs') || supported.includes('rgb') || supported.includes('xy') || supported.includes('brightness')) this.availableModes.push('brightness');
        if (supported.includes('hs') || supported.includes('rgb')) this.availableModes.push('hue', 'saturation');
        if (supported.includes('color_temp')) this.availableModes.push('color_temp');
    } else if (secDomain === 'number' || secDomain === 'input_number') {
        if (isPrimaryMedia) this.availableModes.push('media_volume'); 
        else this.availableModes.push('number');
    } else if (isSecMedia || isPrimaryMedia) {
        this.availableModes.push('media_volume');
    }

    if (!this.availableModes.includes(this.sliderMode)) this.sliderMode = this.availableModes[0] || 'brightness';

    let baseColor = 'rgba(255, 218, 120, 1)'; 
    if (secondaryStateObj?.attributes?.rgb_color) {
      const [r, g, b] = secondaryStateObj.attributes.rgb_color;
      baseColor = `rgb(${r}, ${g}, ${b})`;
    } else if (styling.custom_background) {
      baseColor = styling.custom_background;
    }

    if (isUnavailable || isOff) {
      card.style.setProperty('--mdc-ripple-color', 'rgba(170, 210, 255, 1)');
      card.style.setProperty('--mdc-ripple-press-opacity', '0.2');
    } else {
      if (hasAlbumArt) {
        card.style.setProperty('--mdc-ripple-color', 'rgba(255, 255, 255, 1)');
        card.style.setProperty('--mdc-ripple-press-opacity', '0.15'); 
      } else {
        card.style.setProperty('--mdc-ripple-color', 'rgba(0, 0, 0, 1)');
        card.style.setProperty('--mdc-ripple-press-opacity', '0.02'); 
      }
    }

    if (isUnavailable) {
      card.style.removeProperty('--card-custom-bg');
      card.classList.add('unavailable');
    } else if (isOff && !hasAlbumArt) {
      card.style.removeProperty('--card-custom-bg');
      card.classList.remove('unavailable');
    } else {
      card.classList.remove('unavailable');
      if (hasAlbumArt) {
        card.style.setProperty('--card-custom-bg', 'transparent');
      } else {
        card.style.setProperty('--card-custom-bg', `color-mix(in srgb, ${baseColor} ${bgOp}%, transparent)`);
      }
    }

    if (isOff || isUnavailable || isSecUnavailable || this.availableModes.length === 0) controlsEl.classList.add('hidden');
    else {
      controlsEl.classList.remove('hidden');
      modeBtn.style.display = this.availableModes.length > 1 ? 'flex' : 'none';
      
      if (this.sliderMode === 'media_controls') {
        slider.style.display = 'none';
        mediaControls.classList.add('active');
        modeIcon.icon = 'mdi:volume-high';
        
        let mediaStateObj = stateObj;
        if (!isPrimaryMedia && isSecMedia) mediaStateObj = secondaryStateObj;
        
        const isPlaying = mediaStateObj && (mediaStateObj.state === 'playing' || mediaStateObj.state === 'on');
        this.shadowRoot.getElementById('play-icon').icon = isPlaying ? 'mdi:pause' : 'mdi:play';
      } else {
        slider.style.display = 'block';
        mediaControls.classList.remove('active');
        const iconMap = { 'brightness': 'mdi:brightness-4', 'hue': 'mdi:palette', 'saturation': 'mdi:water-opacity', 'color_temp': 'mdi:thermometer', 'number': 'mdi:numeric', 'media_volume': 'mdi:play-box-multiple' };
        modeIcon.icon = iconMap[this.sliderMode] || 'mdi:brightness-6';
        if (!this._isSliding || forceUpdate) {
          
          if (this.sliderMode === 'brightness') slider.value = Math.round(((secondaryStateObj.attributes.brightness || 0) / 255) * 100);
          else if (this.sliderMode === 'hue') slider.value = this.currentHue || 0;
          else if (this.sliderMode === 'saturation') slider.value = this.currentSat || 0;
          else if (this.sliderMode === 'color_temp') {
            slider.min = secondaryStateObj.attributes.min_color_temp_kelvin || 2000;
            slider.max = secondaryStateObj.attributes.max_color_temp_kelvin || 6500;
            slider.value = secondaryStateObj.attributes.color_temp_kelvin || 4000;
          } else if (this.sliderMode === 'number') {
             slider.min = secondaryStateObj.attributes.min ?? 0;
             slider.max = secondaryStateObj.attributes.max ?? 100;
             slider.step = secondaryStateObj.attributes.step ?? 1;
             slider.value = secondaryStateObj.state || 0;
          } else if (this.sliderMode === 'media_volume') {
             // Seamlessly read from number if provided, otherwise native media volume
             let volEntityId = this.config.entity;
             if (this.config.use_secondary_entity && this.config.secondary_entity) {
                 const secDom = this.config.secondary_entity.split('.')[0];
                 const primDom = this.config.entity.split('.')[0];
                 if (primDom === 'media_player' && (secDom === 'number' || secDom === 'input_number')) {
                     volEntityId = this.config.secondary_entity;
                 } else if (secDom === 'media_player') {
                     volEntityId = this.config.secondary_entity;
                 }
             }

             let volStateObj = this._hass.states[volEntityId];
             let volLevel = 0;
             if (volStateObj) {
               if (volStateObj.entity_id.startsWith('number.') || volStateObj.entity_id.startsWith('input_number.')) {
                  volLevel = parseFloat(volStateObj.state) || 0;
                  slider.min = volStateObj.attributes.min ?? 0;
                  slider.max = volStateObj.attributes.max ?? 100;
                  slider.step = volStateObj.attributes.step ?? 1;
               } else {
                  volLevel = (volStateObj.attributes.volume_level || 0) * 100;
                  slider.min = 0; slider.max = 100; slider.step = 1;
               }
             }
             slider.value = Math.round(volLevel);
          }
          this.updateSliderBackground(slider.value);
        }
      }
    }
  }

  // =======================================================
  // 4. INTERACTION & EVENT LISTENERS
  // =======================================================
  bindMediaActions() {
    const callMedia = (service) => {
      let targetEntity = this.config.entity;
      if (!targetEntity.startsWith('media_player.') && this.config.use_secondary_entity && this.config.secondary_entity?.startsWith('media_player.')) {
          targetEntity = this.config.secondary_entity;
      }
      this._hass.callService('media_player', service, { entity_id: targetEntity });
      this.fireHaptic('light');
    };
    this.shadowRoot.getElementById('btn-shuffle').addEventListener('click', (e) => { e.stopPropagation(); callMedia('shuffle_set'); });
    this.shadowRoot.getElementById('btn-prev').addEventListener('click', (e) => { e.stopPropagation(); callMedia('media_previous_track'); });
    this.shadowRoot.getElementById('btn-next').addEventListener('click', (e) => { e.stopPropagation(); callMedia('media_next_track'); });
    this.shadowRoot.getElementById('btn-play').addEventListener('click', (e) => { 
      e.stopPropagation(); 
      const playIcon = this.shadowRoot.getElementById('play-icon');
      playIcon.icon = playIcon.icon === 'mdi:play' ? 'mdi:pause' : 'mdi:play';
      callMedia('media_play_pause'); 
    });
  }

  bindActions() {
    const card = this.shadowRoot.getElementById('card');
    const ripple = this.shadowRoot.getElementById('ripple');
    const iconWrapper = this.shadowRoot.getElementById('icon-wrapper');
    let holdTimer = null;
    let holdFired = false;
    let startX = 0;
    let startY = 0;

    const hasIconAction = () => this.config.icon_tap_action && this.config.icon_tap_action.action !== 'none';
    const hasTapAction = () => this.config.tap_action && this.config.tap_action.action !== 'none';
    const hasHoldAction = () => this.config.hold_action && this.config.hold_action.action !== 'none';

    const handleStart = (e) => {
      holdFired = false;
      const path = e.composedPath();
      const isIconClick = path.some(el => el.id === 'icon-wrapper');
      
      if (path.some(el => el.tagName === 'INPUT' || el.tagName === 'BUTTON' || el.classList?.contains('mode-button'))) return;
      if (isIconClick && hasIconAction()) return; 

      startX = e.touches ? e.touches[0].clientX : e.clientX;
      startY = e.touches ? e.touches[0].clientY : e.clientY;

      if (hasHoldAction()) {
        holdTimer = setTimeout(() => {
          holdFired = true;
          this.fireHaptic('medium');
          this.handleClick(this.config.hold_action);
          holdTimer = null;
        }, 500);
      }
    };

    const handleMove = (e) => {
      if (!holdTimer) return;
      const currentX = e.touches ? e.touches[0].clientX : e.clientX;
      const currentY = e.touches ? e.touches[0].clientY : e.clientY;
      if (Math.abs(currentX - startX) > 10 || Math.abs(currentY - startY) > 10) {
        clearTimeout(holdTimer);
        holdTimer = null;
      }
    };

    const handleEnd = () => { 
      if (holdTimer) { clearTimeout(holdTimer); holdTimer = null; }
    };

    card.addEventListener('mousedown', handleStart);
    card.addEventListener('touchstart', handleStart, {passive: true});
    card.addEventListener('mousemove', handleMove);
    card.addEventListener('touchmove', handleMove, {passive: true});
    window.addEventListener('mouseup', handleEnd);
    window.addEventListener('touchend', handleEnd);
    card.addEventListener('mouseleave', handleEnd);
    card.addEventListener('touchcancel', handleEnd);

    card.addEventListener('click', (e) => {
      if (holdFired) { e.preventDefault(); e.stopPropagation(); return; }
      
      const path = e.composedPath();
      if (path.some(el => el.tagName === 'INPUT' || el.tagName === 'BUTTON' || el.classList?.contains('mode-button'))) return;

      const isIconClick = path.some(el => el.id === 'icon-wrapper');

      if (isIconClick && hasIconAction()) {
          this.fireHaptic('light');
          this.handleClick(this.config.icon_tap_action);
          return;
      }

      if (!card.classList.contains('unavailable') && hasTapAction()) {
        this.fireHaptic('light');
        if (ripple) {
          ripple.startPress(e);
          setTimeout(() => ripple.endPress(), 200); 
        }
        this.handleClick(this.config.tap_action);
      }
    });
    
    card.addEventListener('contextmenu', (e) => { if (holdFired) e.preventDefault(); });
  }

  handleClick(actionConfig) {
    if (!actionConfig || actionConfig.action === 'none') return;
    if (actionConfig.action === 'toggle') this._hass.callService('homeassistant', 'toggle', { entity_id: this.config.entity });
    else if (actionConfig.action === 'more-info') {
      const event = new Event('hass-more-info', { bubbles: true, composed: true });
      event.detail = { entityId: this.config.entity };
      this.dispatchEvent(event);
    }
  }

  getCardSize() { return 2; }
}
customElements.define('omnilistic-card', OmnilisticCard);


// ============================================================================
// OMNILISTIC CARD - NESTED UI EDITOR
// ============================================================================

class OmnilisticCardEditor extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this._rendered = false;
  }

  setConfig(config) {
    this._config = { ...config };
    
    const mainDomain = this._config.entity ? this._config.entity.split('.')[0] : "";
    const secDomain = (this._config.use_secondary_entity && this._config.secondary_entity) ? this._config.secondary_entity.split('.')[0] : "";
    if (mainDomain === 'media_player' || secDomain === 'media_player') {
      if (!this._config.styling) this._config.styling = {};
      if (this._config.styling.dynamic_album_art === undefined) {
         this._config.styling.dynamic_album_art = true;
      }
    }
    
    this.render();
  }

  set hass(hass) {
    this._hass = hass;
    if (this._formTop) this._formTop.hass = hass;
    if (this._formActions) this._formActions.hass = hass;
    if (this._formTypography) this._formTypography.hass = hass;
    if (this._formStyle) this._formStyle.hass = hass;
  }

  render() {
    if (!this._config || !this._hass) return;
    if (!this._rendered) {
      this.shadowRoot.innerHTML = `
        <style>
          .section-wrapper { margin-top: 24px; }
          ha-expansion-panel { --ha-card-border-radius: 6px; display: block; }
          .panel-content { padding: 16px 12px; }
          .custom-reset-row { display: flex; justify-content: space-between; align-items: center; padding-bottom: 16px; margin-bottom: 12px; border-bottom: 1px solid rgba(128,128,128,0.2); }
          .reset-text { font-size: 14px; font-weight: bold; color: var(--primary-text-color); }
          .icon-btn { background: var(--error-color, #db4437); color: white; border: none; border-radius: 8px; width: 32px; height: 32px; display: flex; align-items: center; justify-content: center; cursor: pointer; transition: opacity 0.2s; padding: 0; flex-shrink: 0; }
          .icon-btn:hover { opacity: 0.8; }
          .icon-btn ha-icon { --mdc-icon-size: 18px; }
          .bottom-spacer { height: 40px; }
          .sub-panel { margin-bottom: 12px; }
        </style>
        <ha-form id="form-top"></ha-form>
        <div class="section-wrapper">
          <ha-expansion-panel outlined header="Interactions & Actions">
            <div class="panel-content"><ha-form id="form-actions"></ha-form></div>
          </ha-expansion-panel>
        </div>
        <div class="section-wrapper">
          <ha-expansion-panel outlined header="Appearance & Design">
            <div class="panel-content">
              <div class="custom-reset-row">
                <span class="reset-text">Reset All Styling</span>
                <button id="reset-btn" class="icon-btn"><ha-icon icon="mdi:refresh"></ha-icon></button>
              </div>
              <div class="sub-panel">
                <ha-expansion-panel header="Typography">
                  <div style="padding: 8px 0;"><ha-form id="form-typography"></ha-form></div>
                </ha-expansion-panel>
              </div>
              <div class="sub-panel">
                <ha-expansion-panel header="Design">
                  <div style="padding: 8px 0;"><ha-form id="form-style"></ha-form></div>
                </ha-expansion-panel>
              </div>
            </div>
          </ha-expansion-panel>
        </div>
        <div class="bottom-spacer"></div>
      `;
      
      this._formTop = this.shadowRoot.getElementById('form-top');
      this._formActions = this.shadowRoot.getElementById('form-actions');
      this._formTypography = this.shadowRoot.getElementById('form-typography');
      this._formStyle = this.shadowRoot.getElementById('form-style');
      
      const fireChanged = () => {
        this.dispatchEvent(new CustomEvent('config-changed', { detail: { config: this._config }, bubbles: true, composed: true }));
      };
      this.shadowRoot.getElementById('reset-btn').addEventListener('click', () => {
        let newConfig = { ...this._config };
        delete newConfig.styling; 
        this._config = newConfig;
        fireChanged();
      });
      this._formTop.addEventListener('value-changed', (ev) => { this._config = { ...this._config, ...ev.detail.value }; fireChanged(); });
      this._formActions.addEventListener('value-changed', (ev) => { this._config = { ...this._config, ...ev.detail.value }; fireChanged(); });
      this._formTypography.addEventListener('value-changed', (ev) => { this._config = { ...this._config, styling: { ...(this._config.styling || {}), ...ev.detail.value } }; fireChanged(); });
      this._formStyle.addEventListener('value-changed', (ev) => { this._config = { ...this._config, styling: { ...(this._config.styling || {}), ...ev.detail.value } }; fireChanged(); });
      this._rendered = true;
    }
    
    this._formTop.hass = this._hass; this._formTop.data = this._config; this._formTop.schema = this.getTopSchema(); this._formTop.computeLabel = this._computeLabel;
    this._formActions.hass = this._hass; this._formActions.data = this._config; this._formActions.schema = this.getActionsSchema(); this._formActions.computeLabel = this._computeLabel;
    this._formTypography.hass = this._hass; this._formTypography.data = this._config.styling || {}; this._formTypography.schema = this.getTypographySchema(); this._formTypography.computeLabel = this._computeLabel;
    this._formStyle.hass = this._hass; this._formStyle.data = this._config.styling || {}; this._formStyle.schema = this.getStyleSchema(); this._formStyle.computeLabel = this._computeLabel;
  }

  getTopSchema() {
    const targetEntity = (this._config?.use_secondary_entity && this._config?.secondary_entity) ? this._config.secondary_entity : this._config?.entity || "";
    const allowedDomains = ["light", "switch", "media_player", "climate", "cover", "fan", "vacuum", "lock", "sensor", "binary_sensor", "button", "input_boolean", "number", "input_number", "select", "person"];
    const entitySelector = { entity: { domain: allowedDomains, exclude_integration: "browser_mod" } };
    let attrOptions = [{label: "None (Empty)", value: "none"}, {label: "Entity State (state)", value: "state"}];
    if (this._hass && targetEntity && this._hass.states[targetEntity]) {
      Object.keys(this._hass.states[targetEntity].attributes).forEach(a => attrOptions.push({label: a, value: a}));
    }
    
    const mainDomain = this._config?.entity ? this._config.entity.split('.')[0] : "";
    const secDomain = (this._config?.use_secondary_entity && this._config?.secondary_entity) ? this._config.secondary_entity.split('.')[0] : "";
    const isMedia = mainDomain === 'media_player' || secDomain === 'media_player';

    if (isMedia) {
        if (!attrOptions.some(opt => opt.value === 'volume_level')) {
            attrOptions.push({label: "Volume (volume_level)", value: "volume_level"});
        }
    }

    const currentIcon = this._config?.icon || "";
    const knownPairs = ['mdi:lightbulb', 'mdi:flash', 'mdi:fan', 'mdi:toggle-switch', 'mdi:speaker', 'mdi:television', 'mdi:lamp', 'mdi:desk-lamp', 'mdi:floor-lamp', 'mdi:ceiling-light', 'mdi:wall-sconce', 'mdi:led-strip', 'mdi:string-lights', 'mdi:chandelier', 'mdi:track-light', 'mdi:vanity-light', 'mdi:microphone', 'mdi:camera', 'mdi:video', 'mdi:wifi', 'mdi:bluetooth', 'mdi:bell', 'mdi:alarm', 'mdi:projector', 'mdi:air-purifier', 'mdi:air-humidifier', 'mdi:water-heater', 'mdi:curtains', 'mdi:blinds', 'mdi:door', 'mdi:window', 'mdi:garage', 'mdi:garage-variant', 'mdi:gate', 'mdi:sofa', 'mdi:bed', 'mdi:fridge', 'mdi:washing-machine', 'mdi:tumble-dryer', 'mdi:power-socket', 'mdi:power-plug', 'mdi:router', 'mdi:server'];
    const pairSuffixes = ['-on', '-off', '-up', '-down', '-in', '-out', '-left', '-right', '-open', '-closed', '-upload', '-download', '-lock', '-unlock', '-locked', '-unlocked', '-play', '-pause', '-start', '-stop', '-plus', '-minus', '-check', '-close'];
    let hasPair = currentIcon && (pairSuffixes.some(s => currentIcon.endsWith(s)) || knownPairs.includes(currentIcon) || (currentIcon.includes(':') && !currentIcon.startsWith('mdi:')));
    const iconGrid = [{ name: "icon", selector: { icon: {} } }];
    if (!hasPair && currentIcon) iconGrid.push({ name: "icon_off", selector: { icon: {} } });
    
    const schema = [{ name: "entity", selector: entitySelector }, { name: "use_secondary_entity", selector: { boolean: {} } }];
    if (this._config?.use_secondary_entity) schema.push({ name: "secondary_entity", selector: entitySelector });

    schema.push({ name: "name", selector: { text: {} } }, { name: "", type: "grid", schema: iconGrid }, { name: "", type: "grid", schema: [ { name: "attribute_1", selector: { select: { options: attrOptions, custom_value: true } } }, { name: "attribute_2", selector: { select: { options: attrOptions, custom_value: true } } } ] });
    return schema;
  }

  getActionsSchema() {
    return [
      { name: "", type: "grid", schema: [{ name: "enable_haptics", selector: { boolean: {} } }, { name: "haptic_type", selector: { select: { options: ["light", "medium", "heavy", "success", "warning", "error", "selection"] } } } ] }, 
      { name: "tap_action", selector: { ui_action: {} } }, 
      { name: "hold_action", selector: { ui_action: {} } },
      { name: "icon_tap_action", selector: { ui_action: {} } }
    ];
  }

  getTypographySchema() {
    return [
      { name: "", type: "grid", schema: [ 
        { name: "title_font_size", selector: { number: { min: 10, max: 30, mode: "slider", unit_of_measurement: "px" } } }, 
        { name: "title_font_weight", selector: { select: { options: ["normal", "bold"] } } },
        { name: "subtitle_font_weight", selector: { select: { options: ["normal", "bold"] } } }
      ]}, 
      { name: "title_transform", selector: { select: { options: ["none", "uppercase", "lowercase", "capitalize"] } } }
    ];
  }

  getStyleSchema() {
    const mainDomain = this._config?.entity ? this._config.entity.split('.')[0] : "";
    const secDomain = (this._config?.use_secondary_entity && this._config?.secondary_entity) ? this._config.secondary_entity.split('.')[0] : "";
    const isMedia = mainDomain === 'media_player' || secDomain === 'media_player';

    let supportsColor = false;
    [this._config?.entity, this._config?.secondary_entity].forEach(ent => {
      if (ent && this._hass && this._hass.states[ent]) {
        const supportedModes = this._hass.states[ent].attributes?.supported_color_modes || [];
        if (supportedModes.includes('hs') || supportedModes.includes('rgb') || supportedModes.includes('xy')) supportsColor = true;
      }
    });

    const stylingSchema = [
      { name: "", type: "grid", schema: [ 
        { name: "center_layout", selector: { boolean: {} } },
        { name: "hide_name", selector: { boolean: {} } },
        { name: "hide_icon", selector: { boolean: {} } },
        { name: "hide_state", selector: { boolean: {} } }
      ]}
    ];

    stylingSchema.push({ name: "", type: "grid", schema: [ { name: "enable_animations", selector: { boolean: {} } }, ...(isMedia ? [{ name: "dynamic_album_art", selector: { boolean: {} } }] : []) ]});
    if (!supportsColor && !isMedia) stylingSchema.push({ name: "custom_background", selector: { text: {} } });
    stylingSchema.push({ name: "border_radius", selector: { number: { min: 0, max: 50, mode: "slider", unit_of_measurement: "px" } } }, { name: "bg_opacity", selector: { number: { min: 0, max: 100, mode: "slider", unit_of_measurement: "%" } } }, { name: "backdrop_blur", selector: { number: { min: 0, max: 100, mode: "slider", unit_of_measurement: "px" } } }, { name: "", type: "grid", schema: [ { name: "shadow_color", selector: { text: {} } }, { name: "shadow_size", selector: { number: { min: 0, max: 20, mode: "slider", unit_of_measurement: "px" } } } ]}, { name: "shadow_opacity", selector: { number: { min: 0, max: 100, mode: "slider", unit_of_measurement: "%" } } });
    return stylingSchema;
  }

  _computeLabel(schema) {
    const labels = { entity: "Main Entity", use_secondary_entity: "Enable Secondary Entity", secondary_entity: "Secondary Entity", name: "Custom Name", icon: "Custom Icon", center_layout: "Center Content", hide_name: "Hide Name", hide_icon: "Hide Icon", hide_state: "Hide State", title_font_size: "Global Font Size", title_font_weight: "Title Font Weight", subtitle_font_weight: "Subtitle Font Weight", title_transform: "Text Case Format", enable_animations: "Enable Icon Animations", dynamic_album_art: "Extract Media Album Art", border_radius: "Border Radius", bg_opacity: "Background Opacity", backdrop_blur: "Backdrop Blur", shadow_size: "Shadow Spread", shadow_color: "Shadow Color", shadow_opacity: "Shadow Opacity", attribute_1: "First Attribute", attribute_2: "Second Attribute", enable_haptics: "Enable Haptics", tap_action: "Tap Action", hold_action: "Hold Action", icon_tap_action: "Icon Tap Action" };
    return labels[schema.name] || schema.name;
  }
}
customElements.define('omnilistic-card-editor', OmnilisticCardEditor);

window.customCards = window.customCards || [];
window.customCards.push({
  type: "omnilistic-card",
  name: "Omnilistic Card",
  preview: true,
  description: "A precision-engineered custom card with zero-latency controls and dynamic media support."
});

const LitElement = Object.getPrototypeOf(customElements.get("ha-panel-lovelace"));
const html = LitElement.prototype.html;
const css = LitElement.prototype.css;

const COLORS = {
  red: "rgb(211, 47, 47)",
  orange: "rgb(255, 87, 34)",
  amber: "rgb(255, 193, 7)",
  lightGreen: "rgb(139, 195, 74)",
  green: "rgb(76, 175, 80)",
  teal: "rgb(0, 150, 136)",
  blue: "rgb(25, 118, 210)"
};

// Exact mapping of Recommendation 1 thresholds
const SCALES = {
  down: { 
    max: 1000, 
    segments: [
      { c: COLORS.red, min: 0, max: 20 },
      { c: COLORS.orange, min: 20, max: 50 },
      { c: COLORS.amber, min: 50, max: 100 },
      { c: COLORS.lightGreen, min: 100, max: 300 },
      { c: COLORS.green, min: 300, max: 500 },
      { c: COLORS.teal, min: 500, max: 800 },
      { c: COLORS.blue, min: 800, max: 1000 }
    ]
  },
  up: { 
    max: 500, 
    segments: [
      { c: COLORS.red, min: 0, max: 5 },
      { c: COLORS.orange, min: 5, max: 15 },
      { c: COLORS.amber, min: 15, max: 30 },
      { c: COLORS.lightGreen, min: 30, max: 75 },
      { c: COLORS.green, min: 75, max: 150 },
      { c: COLORS.teal, min: 150, max: 300 },
      { c: COLORS.blue, min: 300, max: 500 }
    ]
  },
  ping: { 
    max: 350, 
    segments: [
      { c: COLORS.blue, min: 0, max: 15 },
      { c: COLORS.teal, min: 15, max: 30 },
      { c: COLORS.green, min: 30, max: 60 },
      { c: COLORS.lightGreen, min: 60, max: 100 },
      { c: COLORS.amber, min: 100, max: 150 },
      { c: COLORS.orange, min: 150, max: 250 },
      { c: COLORS.red, min: 250, max: 350 }
    ]
  }
};

class OmnilisticSpeedtest extends LitElement {
  static get properties() {
    return { 
      hass: { type: Object }, 
      config: { type: Object }, 
      _isUpdating: { type: Boolean },
      _currentIcon: { type: String }
    };
  }

  constructor() {
    super();
    this._isUpdating = false;
    this._lastValues = { down: null, up: null, ping: null };
    this._currentIcon = "mdi:play-speed";
    this._animationInterval = null;
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    if (this._animationInterval) {
      clearInterval(this._animationInterval);
    }
  }

  updated(changedProps) {
    if (changedProps.has('hass') && this._isUpdating) {
      const down = this.hass.states[this.config.download_entity]?.state;
      const up = this.hass.states[this.config.upload_entity]?.state;
      const ping = this.hass.states[this.config.ping_entity]?.state;
      
      if (down !== this._lastValues.down || up !== this._lastValues.up || ping !== this._lastValues.ping) {
        this._isUpdating = false;
        clearInterval(this._animationInterval);
        this._currentIcon = "mdi:play-speed";
      }
    }
  }

  _getCurrentColor(val, type) {
    const segments = SCALES[type].segments;
    for (let seg of segments) {
      if (val <= seg.max) return seg.c;
    }
    return segments[segments.length - 1].c;
  }

  _renderGauge(stateObj, label, defaultIcon, unit, type) {
    const val = stateObj ? parseFloat(stateObj.state) : 0;
    const max = SCALES[type].max;
    const pct = Math.min(Math.max(val / max, 0), 1);
    const customIcon = this.config[`${type}_icon`];
    const currentColor = this._getCurrentColor(val, type);

    const paths = SCALES[type].segments.map(seg => {
      const pStart = seg.min / max;
      const pEnd = seg.max / max;
      return {
        c: seg.c,
        dasharray: `${(pEnd - pStart) * 182} 182`,
        dashoffset: `${-pStart * 182}`
      };
    });

    return html`
      <div class="gauge-container">
        <div class="gauge-visual">
          <svg viewBox="0 0 100 85">
            <path class="track-segment" d="M 20 75 A 40 40 0 1 1 80 75" fill="none" stroke-width="1.5" stroke="${paths[0].c}" stroke-dasharray="${paths[0].dasharray}" stroke-dashoffset="${paths[0].dashoffset}" />
            <path class="track-segment" d="M 20 75 A 40 40 0 1 1 80 75" fill="none" stroke-width="1.5" stroke="${paths[1].c}" stroke-dasharray="${paths[1].dasharray}" stroke-dashoffset="${paths[1].dashoffset}" />
            <path class="track-segment" d="M 20 75 A 40 40 0 1 1 80 75" fill="none" stroke-width="1.5" stroke="${paths[2].c}" stroke-dasharray="${paths[2].dasharray}" stroke-dashoffset="${paths[2].dashoffset}" />
            <path class="track-segment" d="M 20 75 A 40 40 0 1 1 80 75" fill="none" stroke-width="1.5" stroke="${paths[3].c}" stroke-dasharray="${paths[3].dasharray}" stroke-dashoffset="${paths[3].dashoffset}" />
            <path class="track-segment" d="M 20 75 A 40 40 0 1 1 80 75" fill="none" stroke-width="1.5" stroke="${paths[4].c}" stroke-dasharray="${paths[4].dasharray}" stroke-dashoffset="${paths[4].dashoffset}" />
            <path class="track-segment" d="M 20 75 A 40 40 0 1 1 80 75" fill="none" stroke-width="1.5" stroke="${paths[5].c}" stroke-dasharray="${paths[5].dasharray}" stroke-dashoffset="${paths[5].dashoffset}" />
            <path class="track-segment" d="M 20 75 A 40 40 0 1 1 80 75" fill="none" stroke-width="1.5" stroke="${paths[6].c}" stroke-dasharray="${paths[6].dasharray}" stroke-dashoffset="${paths[6].dashoffset}" />

            <path class="fill" d="M 20 75 A 40 40 0 1 1 80 75" fill="none" stroke-width="6" stroke="${currentColor}" stroke-dasharray="182" stroke-dashoffset="${182 - (pct * 182)}" />
          </svg>
          <ha-icon class="gauge-icon" icon="${customIcon || defaultIcon}" style="color: ${currentColor}"></ha-icon>
        </div>
        <div class="info">
          <div class="value-row"><span class="num">${val}</span><span class="unit">${unit}</span></div>
          <div class="label">${label}</div>
        </div>
      </div>
    `;
  }

  render() {
    if (!this.config || !this.hass) return html``;
    
    const cardStyle = this.config.background_color ? `background-color: ${this.config.background_color}; border-color: transparent;` : '';

    return html`
      <ha-card style="${cardStyle}">
        <div class="header" @click="${this._runTest}">
          <ha-icon icon="${this._currentIcon}" class="${this._isUpdating ? 'running' : ''}"></ha-icon>
          <span class="title">${this.config.name || 'Speedtest'}</span>
        </div>
        <div class="metrics-row">
          ${this._renderGauge(this.hass.states[this.config.download_entity], "download", "fapro:progress-download", "Mb", "down")}
          ${this._renderGauge(this.hass.states[this.config.upload_entity], "upload", "fapro:progress-upload", "Mb", "up")}
          ${this._renderGauge(this.hass.states[this.config.ping_entity], "ping", "fapro:globe", "Ms", "ping")}
        </div>
      </ha-card>
    `;
  }

  _runTest() {
    if (this.config.script_entity && !this._isUpdating) {
      // Trigger Medium Haptics
      this.dispatchEvent(new CustomEvent("haptic", { detail: "medium", bubbles: true, composed: true }));

      this._lastValues = {
        down: this.hass.states[this.config.download_entity]?.state,
        up: this.hass.states[this.config.upload_entity]?.state,
        ping: this.hass.states[this.config.ping_entity]?.state,
      };
      this._isUpdating = true;

      const animationIcons = ["mdi:speedometer-slow", "mdi:speedometer-medium", "mdi:speedometer"];
      let i = 0;
      this._currentIcon = animationIcons[i];
      
      this._animationInterval = setInterval(() => {
        i = (i + 1) % animationIcons.length;
        this._currentIcon = animationIcons[i];
      }, 400); 

      this.hass.callService("script", "turn_on", { entity_id: this.config.script_entity });
    }
  }

  setConfig(config) { this.config = config; }

  static get styles() {
    return css`
      ha-card { 
        padding: 16px; 
        font-family: var(--paper-font-body1_-_font-family); 
        container-type: inline-size; 
        transition: background-color 0.3s;
      }
      .header { display: flex; align-items: center; gap: 12px; margin-bottom: 4px; cursor: pointer; } 
      
      .header ha-icon { --mdc-icon-size: clamp(20px, 8cqi, 32px); transition: color 0.3s; }
      .title { font-size: clamp(0.7rem, 4cqi, 1rem); font-weight: 500; color: var(--primary-text-color); }
      
      .running { color: var(--primary-color); } 

      .metrics-row { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; }
      .gauge-container { display: flex; flex-direction: column; align-items: center; }
      .gauge-visual { position: relative; width: 100%; max-width: 90px; }
      
      .track-segment { stroke-linecap: butt; opacity: 0.35; }
      .fill { stroke-linecap: round; transition: stroke-dashoffset 2s ease-in-out, stroke 0.5s; }
      
      .gauge-icon { 
        position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); 
        --mdc-icon-size: clamp(22px, 11cqi, 44px); 
        transition: color 0.5s; 
      } 
      .info { text-align: center; margin-top: -12px; line-height: 1; } 
      .num { font-size: clamp(0.6rem, 3.6cqi, 0.9rem); font-weight: 400; color: var(--primary-text-color); }
      .unit { font-size: clamp(0.4rem, 2.4cqi, 0.6rem); font-weight: 300; opacity: 0.6; margin-left: 2px; }
      .label { font-size: clamp(0.45rem, 2.6cqi, 0.65rem); font-weight: 400; text-transform: uppercase; opacity: 0.7; margin-top: 2px; }
    `;
  }

  static getConfigElement() { return document.createElement("omnilistic-speedtest-editor"); }
}

if (!customElements.get("omnilistic-speedtest")) {
  customElements.define("omnilistic-speedtest", OmnilisticSpeedtest);
}

// --- UI EDITOR ---
class OmnilisticEditor extends LitElement {
  static get properties() { return { hass: { type: Object }, _config: { type: Object } }; }
  
  setConfig(config) { this._config = config; }
  
  render() {
    if (!this.hass || !this._config) return html``;

    const schema = [
      { name: "name", selector: { text: {} } },
      { name: "script_entity", selector: { entity: { domain: ["script"] } } },
      { name: "download_entity", selector: { entity: { domain: ["sensor"] } } },
      { name: "down_icon", selector: { icon: {} } },
      { name: "upload_entity", selector: { entity: { domain: ["sensor"] } } },
      { name: "up_icon", selector: { icon: {} } },
      { name: "ping_entity", selector: { entity: { domain: ["sensor"] } } },
      { name: "ping_icon", selector: { icon: {} } }
    ];

    return html`
      <div class="editor-container">
        <ha-form
          .hass=${this.hass}
          .data=${this._config}
          .schema=${schema}
          .computeLabel=${this._computeLabel}
          @value-changed=${this._valueChanged}
        ></ha-form>
        
        <div class="color-picker-row">
          <label>Background Color (Theme Default)</label>
          <div class="color-picker-controls">
            <input type="color" .value="${this._config.background_color || '#ffffff'}" @input="${this._colorChanged}">
            <button class="icon-btn" @click="${this._clearColor}" title="Reset to Theme">
              <ha-icon icon="mdi:refresh"></ha-icon>
            </button>
          </div>
        </div>
      </div>
    `;
  }

  _computeLabel(schema) {
    const labels = {
      name: "Card Name",
      script_entity: "Script Entity",
      download_entity: "Download Entity",
      down_icon: "Download Icon",
      upload_entity: "Upload Entity",
      up_icon: "Upload Icon",
      ping_entity: "Ping Entity",
      ping_icon: "Ping Icon"
    };
    return labels[schema.name];
  }

  _valueChanged(ev) {
    if (!this._config || !this.hass) return;
    const newConfig = ev.detail.value;
    this.dispatchEvent(new CustomEvent("config-changed", {
      detail: { config: newConfig },
      bubbles: true,
      composed: true,
    }));
  }

  _colorChanged(ev) {
    const newConfig = { ...this._config, background_color: ev.target.value };
    this.dispatchEvent(new CustomEvent("config-changed", {
      detail: { config: newConfig },
      bubbles: true,
      composed: true,
    }));
  }

  _clearColor() {
    if (!this._config) return;
    const newConfig = { ...this._config };
    delete newConfig.background_color;
    
    this.dispatchEvent(new CustomEvent("config-changed", {
      detail: { config: newConfig },
      bubbles: true,
      composed: true,
    }));
    this.requestUpdate();
  }

  static get styles() {
    return css`
      .editor-container { padding: 4px; }
      .color-picker-row { display: flex; flex-direction: column; gap: 8px; margin-top: 24px; padding-left: 4px; }
      .color-picker-row label { font-family: var(--paper-font-body1_-_font-family); font-size: 16px; color: var(--primary-text-color); }
      .color-picker-controls { display: flex; align-items: center; gap: 12px; }
      input[type="color"] { width: 45px; height: 35px; border: 1px solid var(--divider-color); border-radius: 4px; cursor: pointer; background: none; padding: 2px; }
      
      .icon-btn {
        background: var(--secondary-background-color, #e0e0e0);
        color: var(--primary-text-color);
        border: none;
        border-radius: 8px;
        width: 35px;
        height: 35px;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: background 0.2s;
      }
      .icon-btn:hover { background: var(--divider-color, #ccc); }
      .icon-btn ha-icon { --mdc-icon-size: 20px; }
    `;
  }
}

if (!customElements.get("omnilistic-speedtest-editor")) {
  customElements.define("omnilistic-speedtest-editor", OmnilisticEditor);
}

window.customCards = window.customCards || [];
if (!window.customCards.some(c => c.type === "omnilistic-speedtest")) {
  window.customCards.push({
    type: "omnilistic-speedtest",
    name: "Omnilistic Speedtest",
    description: "Responsive Speedtest UI Editor Component."
  });
}


// ============================================================
//  Minimal Purifier Card
// ============================================================

const TRANSLATIONS = {
  en: { 
    air_quality:'Air Quality', 
    good:'Good', 
    fair:'Fair', 
    moderate:'Moderate', 
    unhealthy:'Unhealthy', 
    severe:'Severe', 
    hazardous:'Hazardous',
    active:'Active', 
    inactive:'Inactive',
    temperature:'Temperature', 
    humidity:'Humidity',
    speed_adj:'Speed adjustment',
    filter:'Filter'
  }
};

function tr(key) {
  return TRANSLATIONS.en[key] || key;
}

function pmToQuality(pm) {
  const v = parseFloat(pm);
  if (isNaN(v) || v <= 20) return tr('good');
  if (v <= 35)  return tr('fair');
  if (v <= 55)  return tr('moderate');
  if (v <= 80)  return tr('unhealthy');
  if (v <= 120) return tr('severe');
  return tr('hazardous');
}

function pmToColor(pm, primary) {
  const v = parseFloat(pm);
  if (isNaN(v) || v <= 20) return primary; 
  if (v <= 35)  return '#ffb300'; 
  if (v <= 55)  return '#ff7043'; 
  if (v <= 80)  return '#e53935'; 
  if (v <= 120) return '#c62828'; 
  return '#8e0000';             
}

function toHex(color) {
  if (!color) return '#000000';
  if (typeof color === 'string') {
    const c = color.trim();
    if (c.startsWith('#')) return c.length === 7 ? c : '#000000';
    const parts = c.split(',').map(Number);
    if (parts.length === 3) return '#' + parts.map(v => Math.min(255,Math.max(0,v)).toString(16).padStart(2,'0')).join('');
    return '#000000';
  }
  if (Array.isArray(color) && color.length === 3) {
    return '#' + color.map(v => Math.min(255,Math.max(0,Math.round(v))).toString(16).padStart(2,'0')).join('');
  }
  return '#000000';
}

function hexToRgb(hex) {
  const h = toHex(hex).replace('#','');
  return { r:parseInt(h.slice(0,2),16)||0, g:parseInt(h.slice(2,4),16)||0, b:parseInt(h.slice(4,6),16)||0 };
}

function alpha(hex,a) {
  try { const {r,g,b}=hexToRgb(toHex(hex)); return `rgba(${r},${g},${b},${a})`; } catch{return hex;}
}

// ════════════════════════════════════════════════════════════
//  EDITOR
// ════════════════════════════════════════════════════════════
class MinimalPurifierCardEditor extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({mode:'open'});
    this._config = {};
    this._hass   = null;
    this._built  = false;
  }

  setConfig(config) {
    this._config = {...config};
    this._build();
  }

  set hass(hass) {
    this._hass = hass;
    this._build();
  }

  _schema() {
    return [
      { name:'name', selector:{ text:{} } },
      { name:'icon', selector:{ icon:{} } },
      { name:'power_entity', selector:{ entity:{} } },
      { name:'pm_entity',    selector:{ entity:{ domain:'sensor', unit_of_measurement:'µg/m³' } } },
      { name:'temperature_entity', selector:{ entity:{ domain:'sensor', unit_of_measurement:['°C','°F'] } } },
      { name:'humidity_entity',    selector:{ entity:{ domain:'sensor', unit_of_measurement:'%' } } },
      { name:'mode_entity',        selector:{ entity:{} } },
      { name:'speed_entity',       selector:{ entity:{ domain:'number' } } },
      { name:'buzzer_entity',      selector:{ entity:{} } },
      { name:'child_lock_entity',  selector:{ entity:{} } },
      { name:'filter_life_entity', selector:{ entity:{ domain:'sensor' } } },
      { name:'filter_days_entity', selector:{ entity:{ domain:'sensor' } } },
      {
        type:'grid', name:'', flatten:true,
        schema:[
          { name:'show_particles',       selector:{ boolean:{} } },
          { name:'show_background_glow', selector:{ boolean:{} } },
          { name:'show_ring',            selector:{ boolean:{} } },
          { name:'show_ring_glow',       selector:{ boolean:{} } },
          { name:'animate_rings',        selector:{ boolean:{} } },
        ]
      },
      { name:'ring_speed',           selector:{ number:{ min:0, max:100, step:1 } } },
      { name:'particle_speed',       selector:{ number:{ min:0, max:100, step:1 } } },
      { name:'card_opacity', selector:{ number:{ min:0, max:100, step:1 } } },
    ];
  }

  _computeLabel(schema) {
    const labels = {
      name:'Card name', icon:'Card icon', power_entity:'Power switch (fan / switch)',
      pm_entity:'PM2.5 Sensor', temperature_entity:'Temperature Sensor', humidity_entity:'Humidity Sensor',
      mode_entity:'Mode Preset (Input Select/Fan)', speed_entity:'Favorite Speed (Number 0-14)', 
      buzzer_entity:'Buzzer Switch', child_lock_entity:'Child Lock Switch',
      filter_life_entity:'Filter Life Remaining (%) Sensor', filter_days_entity:'Filter Lifetime Remaining (Days) Sensor',
      show_particles:'Show particle animation',
      show_background_glow:'Show background glow', show_ring:'Show ring',
      show_ring_glow:'Show glow around ring', animate_rings:'Animate ring',
      ring_speed:'Ring speed (0-100)',
      particle_speed:'Particle speed (0-100)',
      card_opacity:'Card transparency (0=transparent, 100=solid)'
    };
    return labels[schema.name] || schema.name;
  }

  _build() {
    if (!this._hass) return;
    if (!this._built) {
      this._built = true;
      this.shadowRoot.innerHTML = `
        <style>ha-form { display:block; padding: 4px 0; }</style>
        <ha-form></ha-form>
      `;
      const form = this.shadowRoot.querySelector('ha-form');
      form.addEventListener('value-changed', (e) => {
        e.stopPropagation();
        this._config = e.detail.value;
        this.dispatchEvent(new CustomEvent('config-changed', {
          detail: { config: this._config },
          bubbles: true,
          composed: true,
        }));
      });
    }

    const form = this.shadowRoot.querySelector('ha-form');
    if (!form) return;
    form.hass         = this._hass;
    form.schema       = this._schema();
    form.data         = this._config;
    form.computeLabel = (s) => this._computeLabel(s);
  }
}

customElements.define('minimal-purifier-card-editor', MinimalPurifierCardEditor);

// ════════════════════════════════════════════════════════════
//  MAIN CARD
// ════════════════════════════════════════════════════════════
class MinimalPurifierCard extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({mode:'open'});
    this._config    = {};
    this._hass      = null;
    this._raf       = null;
    this._particles = [];
    this._canvas    = null;
    this._ctx       = null;
    this._builtDOM  = false;
    this._lastSpeed = -1;
    this._lastPMult = -1;
    this._lastP     = null;
    this._lastS     = null;
  }

  static getConfigElement() {
    return document.createElement('minimal-purifier-card-editor');
  }

  static getStubConfig(hass) {
    const s = hass ? hass.states : {};
    return {
      name: 'Minimal Purifier',
      icon: 'mdi:air-purifier',
      power_entity: Object.keys(s).find(e=>e.startsWith('fan.')||e.startsWith('switch.')&&e.includes('purif'))||'',
      animate_rings: true,
      show_particles: true,
      ring_speed: 50,
      particle_speed: 50
    };
  }

  setConfig(config) {
    const newConfig = {
      name:'Minimal Purifier',
      icon:'mdi:air-purifier',
      color_primary:'#00c896', color_secondary:'#00bcd4',
      show_particles:true, show_background_glow:true, show_ring:true, show_ring_glow:true, animate_rings:true,
      ...config,
    };

    const structuralKeys = ['show_particles','show_background_glow','show_ring','show_ring_glow','animate_rings','icon'];
    const needsRebuild = !this._config || structuralKeys.some(k => 
      JSON.stringify(this._config[k]) !== JSON.stringify(newConfig[k])
    );

    this._config = newConfig;
    if (needsRebuild) this._builtDOM = false;
    if (this._hass) this._render();
  }

  set hass(hass) {
    this._hass = hass;
    this._render();
  }

  _togglePower() {
    const eid = this._config.power_entity;
    if (!eid || !this._hass) return;
    const domain = eid.split('.')[0];
    const svc = ['fan','switch','input_boolean','light'].includes(domain) ? domain : 'homeassistant';
    this._hass.callService(svc, 'toggle', { entity_id: eid });
  }

  _toggleEntity(eid) {
    if (!eid || !this._hass) return;
    const domain = eid.split('.')[0];
    const svc = ['fan','switch','input_boolean','light','lock'].includes(domain) ? domain : 'homeassistant';
    this._hass.callService(svc, 'toggle', { entity_id: eid });
  }

  _cycleMode() {
    const eid = this._config.mode_entity;
    if (!eid || !this._hass) return;
    const state = this._hass.states[eid]?.state?.toLowerCase() || '';
    let nextMode = 'Auto';
    if (state.includes('auto')) nextMode = 'Silent';
    else if (state.includes('silent')) nextMode = 'Favorite';
    else if (state.includes('favorite')) nextMode = 'Auto';
    
    const domain = eid.split('.')[0];
    if (domain === 'input_select' || domain === 'select') {
      this._hass.callService(domain, 'select_option', { entity_id: eid, option: nextMode });
    } else if (domain === 'fan') {
      this._hass.callService('fan', 'set_preset_mode', { entity_id: eid, preset_mode: nextMode });
    }
  }

  _setSpeed(percentage) {
    const eid = this._config.speed_entity;
    if (!eid || !this._hass) return;
    const targetVal = Math.round((percentage / 100) * 14);
    this._hass.callService('number', 'set_value', { entity_id: eid, value: targetVal });
  }

  _isOn() {
    const eid = this._config.power_entity;
    if (!eid || !this._hass) return false;
    const state = this._hass.states[eid]?.state || '';
    return !['off','idle','unavailable','unknown',''].includes(state.toLowerCase());
  }

  _stopParticles() {
    if (this._raf) { cancelAnimationFrame(this._raf); this._raf=null; }
  }

  _startParticles(canvas, speed, p, s, speedMult=1) {
    this._stopParticles();
    this._canvas = canvas;
    this._ctx    = canvas.getContext('2d');
    const W=canvas.width, H=canvas.height, cx=W/2, cy=H/2;
    const outerR=W*0.46, innerR=W*0.235;
    const count=[0,18,30,45,62,80][Math.min(speed,5)];
    this._particles = Array.from({length:count},()=>this._newParticle(cx,cy,outerR,true));
    const pRgb=hexToRgb(p), sRgb=hexToRgb(s);
    const loop=()=>{
      this._ctx.clearRect(0,0,W,H);
      const cfg=this._config||{};
      const livePSpd=cfg.particle_speed??50;
      const liveMult=Math.max(0.05,(livePSpd/100)*3.0);
      this._particles.forEach(pt=>{
        pt.dist -= pt.spd*(0.4+speed*0.3)*liveMult;
        pt.x=cx+Math.cos(pt.angle)*pt.dist;
        pt.y=cy+Math.sin(pt.angle)*pt.dist;
        if (pt.dist<=innerR+3){ Object.assign(pt,this._newParticle(cx,cy,outerR,false)); return; }
        const fade=Math.min(1,(pt.dist-innerR)/35);
        const blend=Math.min(1,(pt.dist-innerR)/(outerR-innerR));
        const r=Math.round(pRgb.r*(1-blend)+sRgb.r*blend);
        const g=Math.round(pRgb.g*(1-blend)+sRgb.g*blend);
        const b=Math.round(pRgb.b*(1-blend)+sRgb.b*blend);
        this._ctx.beginPath();
        this._ctx.arc(pt.x,pt.y,pt.size,0,Math.PI*2);
        this._ctx.fillStyle=`rgba(${r},${g},${b},${pt.opacity*fade})`;
        this._ctx.fill();
      });
      this._raf=requestAnimationFrame(loop);
    };
    this._raf=requestAnimationFrame(loop);
  }

  _newParticle(cx,cy,outerR,randomStart){
    const angle=Math.random()*Math.PI*2;
    const dist=randomStart?(outerR*0.4)+Math.random()*outerR*0.6:outerR+Math.random()*10;
    return { x:cx+Math.cos(angle)*dist, y:cy+Math.sin(angle)*dist, angle, dist,
      size:1.2+Math.random()*2, opacity:0.2+Math.random()*0.6, spd:0.5+Math.random()*1.2 };
  }

  _render() {
    if (!this._config || !this._hass) return;
    try {
      const hass=this._hass, cfg=this._config;
      
      const pmRaw=hass?.states[cfg.pm_entity]?.state??null;
      const pmVal=pmRaw??'4';
      const temp=hass?.states[cfg.temperature_entity]?.state??null;
      const hum=hass?.states[cfg.humidity_entity]?.state??null;
      
      const modeState=hass?.states[cfg.mode_entity]?.state?.toLowerCase()||'auto';
      const buzzerState=hass?.states[cfg.buzzer_entity]?.state?.toLowerCase()==='on';
      const lockState=hass?.states[cfg.child_lock_entity]?.state?.toLowerCase()==='on';
      
      const filterLifeRaw = hass?.states[cfg.filter_life_entity]?.state;
      const filterDaysRaw = hass?.states[cfg.filter_days_entity]?.state;
      const filterLife = parseFloat(filterLifeRaw);
      
      const isFavorite = modeState.includes('favorite');

      const speedRaw = parseFloat(hass?.states[cfg.speed_entity]?.state ?? 0);
      const speedPct = isNaN(speedRaw) ? 1 : Math.max(1, Math.round((speedRaw / 14) * 100));

      const fanPct=parseInt(hass?.states[cfg.power_entity]?.attributes?.percentage ?? 0);
      const isOn=this._isOn();
      const speed=isOn ? (fanPct > 0 ? Math.ceil(fanPct/20) : 2) : 0;
      
      const qualityLabel=pmToQuality(pmVal);
      const qualityColor=pmToColor(pmVal, '#00c896');
      const subtitle=isOn ? tr('active') : tr('inactive');
      
      const pmNum = parseFloat(pmVal);
      const p = qualityColor;
      const s = (isNaN(pmNum) || pmNum <= 20) ? '#00bcd4' : qualityColor;

      const fixedAccent = '#00c896'; 
      // FIXED: Power button now strictly uses fixedAccent
      const pwrBg=isOn?`linear-gradient(135deg,${fixedAccent},${alpha(fixedAccent,0.8)})`:`var(--secondary-background-color, rgba(150,150,150,0.2))`;
      const pwrShadow=isOn?`0 4px 16px ${alpha(fixedAccent,0.5)}`:'none';
      const pwrIconColor=isOn?'#fff':`var(--secondary-text-color, #8a9bb0)`;
      
      const showParticle=cfg.show_particles!==false;
      const customIcon=cfg.icon||'mdi:air-purifier';
      const cardOpacity=cfg.card_opacity!=null?Number(cfg.card_opacity):100;

      if (!this._builtDOM) {
        this._builtDOM=true;
        this._stopParticles();
        this.shadowRoot.innerHTML=`
          <style>
            :host{display:block;font-family:-apple-system,'SF Pro Display','Helvetica Neue',sans-serif;width:100%;box-sizing:border-box;}
            .minimal-wrapper { display:flex; flex-direction:column; gap:12px; }
            
            .card, .sub-card {
              background: var(--ha-card-background, var(--card-background-color, #ffffff));
              border-radius: var(--ha-card-border-radius, 28px);
              padding: 24px; width: 100%; box-sizing: border-box;
              box-shadow: var(--ha-card-box-shadow, 0 4px 12px rgba(0,0,0,.04));
              border: var(--ha-card-border-width, 0) solid var(--ha-card-border-color, transparent);
              position: relative; overflow: hidden; opacity: ${cardOpacity/100};
            }
            .sub-card { border-radius: 24px; padding: 16px 24px; overflow: visible; transition: opacity 0.3s ease; }

            .glow-a{position:absolute;top:40px;right:-50px;width:280px;height:200px;
              background:radial-gradient(ellipse,${alpha(p,0.13)} 0%,transparent 70%);border-radius:50%;pointer-events:none;}
            .glow-b{position:absolute;top:90px;left:-50px;width:220px;height:180px;
              background:radial-gradient(ellipse,${alpha(s,0.10)} 0%,transparent 70%);border-radius:50%;pointer-events:none;}
            .header{display:flex;align-items:center;justify-content:space-between;margin-bottom:22px;position:relative;z-index:1;}
            .header-left{display:flex;align-items:center;gap:12px;}
            .header-icon{width:42px;height:42px;border-radius:13px;background:${alpha(s,0.15)};display:flex;align-items:center;justify-content:center;}
            .header-icon ha-icon{--mdc-icon-size:22px;color:${s};}
            .header-title{font-size:clamp(14px,5vw,20px);font-weight:700;color:var(--primary-text-color, #1a2332);letter-spacing:-.3px;line-height:1.2;}
            .header-sub{font-size:12px;color:var(--secondary-text-color, #8a9bb0);margin-top:2px;}
            .power-btn{width:44px;height:44px;border-radius:50%;border:none;cursor:pointer;
              display:flex;align-items:center;justify-content:center;flex-shrink:0;transition:transform .15s,box-shadow .2s,background .3s;}
            .power-btn:hover{transform:scale(1.08);}
            .power-btn ha-icon{--mdc-icon-size:20px;transition:color .3s;}
            .circle-wrap{display:flex;justify-content:center;margin-bottom:10px;position:relative;z-index:1;overflow:visible;}
            canvas.particles{position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);width:360px;height:360px;pointer-events:none;z-index:0;}
            
            .circle-ring {
              position: relative;
              width: 100%;
              max-width: 220px;
              aspect-ratio: 1 / 1;
              flex-shrink: 0;
              display: flex;
              align-items: center;
              justify-content: center;
            }
            .circle-ring-svg{position:absolute;top:0;left:0;width:100%;height:100%;z-index:1;display:${cfg.show_ring===false?'none':'block'};}
            .ring-inner-circle.animating{animation:ringPulse ${(()=>{
              const spd=cfg.ring_speed??50;
              if(spd===0) return '9999';
              return Math.max(0.2, 8-(spd/100)*7.8).toFixed(1);
            })()}s ease-in-out infinite;}
            .ring-inner-circle.paused{animation:none;}
            @keyframes ringPulse{0%,100%{opacity:0.5;}50%{opacity:1;}}
            .circle-inner {
              position: absolute;
              top: 50%; left: 50%; transform: translate(-50%, -50%);
              z-index: 2; text-align: center;
              width: 72%;
              display: flex; flex-direction: column; align-items: center;
            }
            .circle-label{font-size:12px;color:var(--secondary-text-color, #8a9bb0);font-weight:600;text-transform:uppercase;letter-spacing:.8px;margin-bottom:4px;}
            .circle-value{font-size:28px;font-weight:800;letter-spacing:-.5px;line-height:1.1;}
            .circle-pm{font-size:11px;color:var(--secondary-text-color, #8a9bb0);margin-top:7px;display:flex;align-items:center;justify-content:center;gap:5px;}
            .pm-dot{width:7px;height:7px;border-radius:50%;flex-shrink:0;}
            
            .controls-deck { display:flex; justify-content:space-around; align-items:center; }
            .ctrl-btn {
              width:54px; height:54px; border-radius:50%; border:none; cursor:pointer;
              display:flex; align-items:center; justify-content:center;
              transition:transform .15s, background .2s, color .2s;
            }
            .ctrl-btn:hover { transform:scale(1.05); }
            .ctrl-btn ha-icon { --mdc-icon-size:24px; pointer-events:none; }

            .section-title {
              font-size: 15px; font-weight: 700; color: var(--primary-text-color, #1a2332); letter-spacing: -0.2px;
            }

            .speed-card {
              display: none; flex-direction: column; gap: 16px; transition: all 0.3s ease;
            }
            .speed-header { display: flex; justify-content: center; align-items: center; }
            .speed-val { font-size: 15px; font-weight: 700; color: var(--p-color, ${p}); }
            
            .slider-track {
              position: relative; height: 40px; border-radius: 20px; margin: 0 10px;
              background: var(--secondary-background-color, rgba(0,0,0,0.08)); 
              cursor: pointer; touch-action: none; user-select: none;
            }
            .slider-fill {
              position: absolute; left: 0; top: 0; bottom: 0; min-width: 40px; border-radius: 20px;
              background: var(--p-color, ${p});
              pointer-events: none;
            }
            .slider-thumb {
              position: absolute; top: 4px; right: 4px; width: 32px; height: 32px; border-radius: 50%;
              background: #fff; box-shadow: 0 2px 8px rgba(0,0,0,0.15); pointer-events: none;
            }

            .filter-card { display: none; align-items: center; gap: 16px; }
            .filter-icon-wrap {
              width: 48px; height: 48px; border-radius: 50%;
              display: flex; align-items: center; justify-content: center;
            }
            .filter-icon-wrap ha-icon { --mdc-icon-size: 24px; }
            .filter-info { display: flex; flex-direction: column; gap: 4px; flex: 1; justify-content: center; }
            .filter-stats { display: flex; flex-direction: column; gap: 2px; }
            .filter-stat { font-size: 13px; color: var(--secondary-text-color, #8a9bb0); font-weight: 500; }
            .filter-stat span { font-weight: 700; color: var(--primary-text-color, #1a2332); }
          </style>
          
          <div class="minimal-wrapper">
            <div class="card">
              <div class="glow-a" id="glow-a"></div><div class="glow-b" id="glow-b"></div>
              <div class="header">
                <div class="header-left">
                  <div class="header-icon"><ha-icon icon="${customIcon}"></ha-icon></div>
                  <div style="display:flex;flex-direction:column;justify-content:center;">
                    <div class="header-title" id="card-name"></div>
                    <div class="header-sub" id="card-sub"></div>
                  </div>
                </div>
                <button class="power-btn" id="power-btn">
                  <ha-icon icon="mdi:power"></ha-icon>
                </button>
              </div>
              <div class="circle-wrap">
                <div class="circle-ring" id="circle-container">
                  ${showParticle?'<canvas class="particles" width="360" height="360"></canvas>':''}
                  <svg class="circle-ring-svg" viewBox="0 0 100 100" preserveAspectRatio="xMidYMid meet">
                    <defs>
                      <linearGradient id="rg" x1="0%" y1="0%" x2="100%" y2="0%">
                        <stop id="grad-stop-1" offset="0%" stop-color="${s}"/>
                        <stop id="grad-stop-2" offset="100%" stop-color="${p}"/>
                      </linearGradient>
                      <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
                        <feGaussianBlur stdDeviation="2" result="b"/>
                        <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
                      </filter>
                    </defs>
                    <circle cx="50" cy="50" r="46" fill="none" stroke="var(--divider-color, rgba(150,150,150,0.15))" stroke-width="4"/>
                    <circle class="ring-inner-circle ${cfg.animate_rings!==false?'animating':'paused'}"
                      cx="50" cy="50" r="46" fill="none"
                      stroke="url(#rg)" stroke-width="4"
                      ${cfg.show_ring_glow!==false?'filter="url(#glow)"':''} opacity="0.9"/>
                  </svg>
                  <div class="circle-inner" id="circle-inner-content"></div>
                </div>
              </div>
            </div>
            
            <div class="sub-card controls-deck" id="controls-card">
              <button class="ctrl-btn" id="btn-mode"><ha-icon id="icon-mode" icon="mdi:refresh-auto"></ha-icon></button>
              <button class="ctrl-btn" id="btn-buzzer"><ha-icon id="icon-buzzer" icon="mdi:volume-off"></ha-icon></button>
              <button class="ctrl-btn" id="btn-lock"><ha-icon id="icon-lock" icon="mdi:lock-open"></ha-icon></button>
            </div>

            <div class="sub-card speed-card" id="speed-card">
              <div class="speed-header section-title">
                <span>${tr('speed_adj')}</span><span style="margin:0 6px; color:var(--secondary-text-color, #8a9bb0); font-weight:400;">|</span><span class="speed-val" id="speed-val">1%</span>
              </div>
              <div class="slider-track" id="speed-track">
                <div class="slider-fill" id="speed-fill" style="width:1%">
                  <div class="slider-thumb" id="speed-thumb"></div>
                </div>
              </div>
            </div>

            <div class="sub-card filter-card" id="filter-card">
              <div class="filter-icon-wrap" id="filter-icon-wrap">
                <ha-icon icon="mdi:air-filter" id="filter-icon"></ha-icon>
              </div>
              <div class="filter-info">
                <div class="section-title">${tr('filter')}</div>
                <div class="filter-stats">
                  <div class="filter-stat"><span id="filter-life-val">--</span>% remaining, <span id="filter-days-val">--</span> days remaining</div>
                </div>
              </div>
            </div>
          </div>`;

        this.shadowRoot.getElementById('power-btn')?.addEventListener('click',()=>this._togglePower());
        this.shadowRoot.getElementById('btn-mode')?.addEventListener('click',()=>this._cycleMode());
        this.shadowRoot.getElementById('btn-buzzer')?.addEventListener('click',()=>this._toggleEntity(this._config.buzzer_entity));
        this.shadowRoot.getElementById('btn-lock')?.addEventListener('click',()=>this._toggleEntity(this._config.child_lock_entity));
      }

      const root=this.shadowRoot;
      
      const stop1 = root.getElementById('grad-stop-1');
      const stop2 = root.getElementById('grad-stop-2');
      if (stop1) stop1.setAttribute('stop-color', s);
      if (stop2) stop2.setAttribute('stop-color', p);
      
      const glowA=root.getElementById('glow-a');
      const glowB=root.getElementById('glow-b');
      if(glowA) { glowA.style.display=cfg.show_background_glow!==false?'block':'none'; glowA.style.background=`radial-gradient(ellipse,${alpha(p,0.13)} 0%,transparent 70%)`; }
      if(glowB) { glowB.style.display=cfg.show_background_glow!==false?'block':'none'; glowB.style.background=`radial-gradient(ellipse,${alpha(s,0.10)} 0%,transparent 70%)`; }

      const nameEl=root.getElementById('card-name'); if(nameEl) nameEl.textContent=cfg.name||'Minimal Purifier';
      const subEl=root.getElementById('card-sub');   if(subEl)  subEl.textContent=subtitle;
      
      const pwrBtn=root.getElementById('power-btn');
      if(pwrBtn){ pwrBtn.style.background=pwrBg; pwrBtn.style.boxShadow=pwrShadow; pwrBtn.querySelector('ha-icon').style.color=pwrIconColor; }
      
      const iconEl=root.querySelector('.header-icon ha-icon');
      if(iconEl && iconEl.getAttribute('icon') !== customIcon) iconEl.setAttribute('icon', customIcon);
      const headerIconBox=root.querySelector('.header-icon');
      if(headerIconBox) headerIconBox.style.background = alpha(s,0.15);
      if(iconEl) iconEl.style.color = s;

      const circleInner=root.getElementById('circle-inner-content');
      if(circleInner){
        let extraHtml = '';
        if(temp || hum) {
          extraHtml += `<div class="circle-pm" style="margin-top:2px;">`;
          if(temp) extraHtml += `<span>${tr('temperature')}: ${temp}°C</span>`;
          if(temp && hum) extraHtml += `<span style="margin:0 4px;">|</span>`;
          if(hum) extraHtml += `<span>${tr('humidity')}: ${hum}%</span>`;
          extraHtml += `</div>`;
        }

        circleInner.innerHTML=
          '<div class="circle-label">'+tr('air_quality')+'</div>'+
          '<div class="circle-value" style="color:'+qualityColor+'">'+qualityLabel+'</div>'+
          '<div class="circle-pm">'+
          '<span class="pm-dot" style="background:'+qualityColor+'"></span>'+
          '<span>'+(pmRaw?'PM2.5: '+pmRaw+' µg/m³':'PM2.5: – µg/m³')+'</span>'+
          '</div>' + extraHtml;
      }

      const ringEl=root.querySelector('.ring-inner-circle');
      if(ringEl && cfg.animate_rings!==false){
        const rSpd=cfg.ring_speed??50;
        const rDur=rSpd===0?'9999s':Math.max(0.2,8-(rSpd/100)*7.8).toFixed(1)+'s';
        ringEl.style.animationDuration=rDur;
      }

      // Update Controls UI + Disable Logic if OFF
      const controlsCard = root.getElementById('controls-card');
      if (controlsCard) {
        controlsCard.style.opacity = isOn ? '1' : '0.4';
        controlsCard.style.pointerEvents = isOn ? 'auto' : 'none';
      }

      const btnMode = root.getElementById('btn-mode');
      const iconMode = root.getElementById('icon-mode');
      if (btnMode && iconMode) {
        if (modeState.includes('silent')) { iconMode.setAttribute('icon', 'mdi:weather-night'); }
        else if (modeState.includes('favorite')) { iconMode.setAttribute('icon', 'mdi:heart-outline'); }
        else { iconMode.setAttribute('icon', 'mdi:refresh-auto'); }
        btnMode.style.color = fixedAccent;
        btnMode.style.background = alpha(fixedAccent, 0.15);
      }

      const btnBuzzer = root.getElementById('btn-buzzer');
      const iconBuzzer = root.getElementById('icon-buzzer');
      if (btnBuzzer && iconBuzzer) {
        iconBuzzer.setAttribute('icon', buzzerState ? 'mdi:volume-high' : 'mdi:volume-off');
        btnBuzzer.style.color = buzzerState ? fixedAccent : `var(--secondary-text-color, #8a9bb0)`;
        btnBuzzer.style.background = buzzerState ? alpha(fixedAccent, 0.15) : `var(--secondary-background-color, rgba(0,0,0,0.05))`;
      }

      const btnLock = root.getElementById('btn-lock');
      const iconLock = root.getElementById('icon-lock');
      if (btnLock && iconLock) {
        iconLock.setAttribute('icon', lockState ? 'mdi:lock' : 'mdi:lock-open');
        btnLock.style.color = lockState ? '#e53935' : `var(--secondary-text-color, #8a9bb0)`;
        btnLock.style.background = lockState ? alpha('#e53935', 0.15) : `var(--secondary-background-color, rgba(0,0,0,0.05))`;
      }

      const speedCard = root.getElementById('speed-card');
      if (speedCard) {
        speedCard.style.display = isFavorite ? 'flex' : 'none';
        speedCard.style.setProperty('--p-color', fixedAccent);
        speedCard.style.opacity = isOn ? '1' : '0.4';
        speedCard.style.pointerEvents = isOn ? 'auto' : 'none';
      }

      const speedTrack = root.getElementById('speed-track');
      if (speedTrack && !speedTrack._initialized) {
        speedTrack._initialized = true;
        let dragging = false;

        speedTrack.addEventListener('touchstart', (e) => { e.stopPropagation(); }, { passive: true });
        speedTrack.addEventListener('touchmove', (e) => { e.preventDefault(); e.stopPropagation(); }, { passive: false });

        const getPct = (clientX) => {
          const rect = speedTrack.getBoundingClientRect();
          return Math.round(Math.min(100, Math.max(1, ((clientX - rect.left) / rect.width) * 100)));
        };

        const updateVisual = (pct) => {
          const val14 = Math.round((pct / 100) * 14);
          const snappedPct = Math.max(1, Math.round((val14 / 14) * 100));
          
          speedTrack._currentPct = snappedPct;
          const fill  = root.getElementById('speed-fill');
          const val   = root.getElementById('speed-val');
          
          if (fill) fill.style.width = snappedPct + '%';
          if (val)  val.textContent  = snappedPct + '%';
        };

        speedTrack.addEventListener('pointerdown', (e) => {
          if (!isOn) return;
          dragging = true;
          speedTrack.setPointerCapture(e.pointerId);
          e.preventDefault(); e.stopPropagation();
          updateVisual(getPct(e.clientX));
        });

        speedTrack.addEventListener('pointermove', (e) => {
          if (!dragging) return;
          e.preventDefault(); e.stopPropagation();
          updateVisual(getPct(e.clientX));
        });

        speedTrack.addEventListener('pointerup', (e) => {
          if (!dragging) return;
          dragging = false;
          updateVisual(getPct(e.clientX));
          
          speedTrack._ignoreHAUntil = Date.now() + 2500;
          this._setSpeed(speedTrack._currentPct); 
        });

        speedTrack.addEventListener('pointercancel', () => { dragging = false; });
      }

      const now = Date.now();
      if (speedTrack && !speedTrack.hasPointerCapture(speedTrack._pointerId) && (!speedTrack._ignoreHAUntil || now > speedTrack._ignoreHAUntil)) {
        const fill  = root.getElementById('speed-fill');
        const val   = root.getElementById('speed-val');
        if (fill) fill.style.width = speedPct + '%';
        if (val)  val.textContent  = speedPct + '%';
      }

      const filterCard = root.getElementById('filter-card');
      if (filterCard && (cfg.filter_life_entity || cfg.filter_days_entity)) {
        filterCard.style.display = 'flex';
        root.getElementById('filter-life-val').textContent = isNaN(filterLife) ? '--' : filterLife;
        root.getElementById('filter-days-val').textContent = filterDaysRaw || '--';

        let fColor = '#00c896'; 
        if (!isNaN(filterLife)) {
          if (filterLife <= 5) fColor = '#e53935'; 
          else if (filterLife <= 15) fColor = '#ff7043';
          else if (filterLife <= 30) fColor = '#ffb300';
        }
        
        const fIconWrap = root.getElementById('filter-icon-wrap');
        const fIcon = root.getElementById('filter-icon');
        if (fIconWrap) fIconWrap.style.background = alpha(fColor, 0.15);
        if (fIcon) fIcon.style.color = fColor;
      }

      if(showParticle){
        const canvas=root.querySelector('canvas.particles');
        if(canvas){
          const pSpd=cfg.particle_speed??50;
          const pMult=Math.max(0.05,(pSpd/100)*3.0);
          const needRestartP=speed!==this._lastSpeed||!this._raf||
            pMult!==this._lastPMult||p!==this._lastP||s!==this._lastS;
          if(needRestartP){
            this._lastSpeed=speed;
            this._lastPMult=pMult;
            this._lastP=p;
            this._lastS=s;
            if(speed===0){ this._stopParticles(); this._ctx?.clearRect(0,0,canvas.width,canvas.height); }
            else { this._startParticles(canvas,speed,p,s,pMult); }
          }
        }
      } else { this._stopParticles(); }
    } catch(e) {
      console.error('MinimalPurifierCard render error:', e);
    }
  }

  disconnectedCallback(){ this._stopParticles(); }
  getCardSize(){ return 8; }
}

customElements.define('minimal-purifier-card', MinimalPurifierCard);

window.customCards = window.customCards || [];
window.customCards.push({
  type:        'minimal-purifier-card',
  name:        'Minimal Purifier Card',
  description: 'Simplified air purifier card with controls deck, dynamic speed slider, PM2.5 monitoring, and filter stats.',
  preview:     true,
});
