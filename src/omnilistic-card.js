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