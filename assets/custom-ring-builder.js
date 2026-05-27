(function () {
  'use strict';

  var theme = window.JoyariTheme || {};

  function stripTags(value) {
    return String(value || '').replace(/<[^>]*>/g, '');
  }

  function formatWithDelimiters(number, precision, thousands, decimal) {
    precision = precision == null ? 2 : precision;
    thousands = thousands || ',';
    decimal = decimal || '.';

    if (isNaN(number) || number == null) return '0';

    var fixed = (number / 100).toFixed(precision);
    var parts = fixed.split('.');
    var dollars = parts[0].replace(/(\d)(?=(\d\d\d)+(?!\d))/g, '$1' + thousands);
    return dollars + (parts[1] ? decimal + parts[1] : '');
  }

  function formatMoney(cents) {
    if (!theme.moneyFormat) return '$' + formatWithDelimiters(cents, 2);

    var format = theme.moneyFormat;
    var placeholder = format.match(/\{\{\s*(\w+)\s*\}\}/);
    var amount;

    switch (placeholder && placeholder[1]) {
      case 'amount_no_decimals':
        amount = formatWithDelimiters(cents, 0);
        break;
      case 'amount_with_comma_separator':
        amount = formatWithDelimiters(cents, 2, '.', ',');
        break;
      case 'amount_no_decimals_with_comma_separator':
        amount = formatWithDelimiters(cents, 0, '.', ',');
        break;
      default:
        amount = formatWithDelimiters(cents, 2);
        break;
    }

    return stripTags(format.replace(/\{\{\s*\w+\s*\}\}/, amount));
  }

  function checked(root, selector) {
    return root.querySelector(selector + ':checked');
  }

  function text(root, selector, value) {
    root.querySelectorAll(selector).forEach(function (element) {
      element.textContent = value;
    });
  }

  function readChoice(input, fallback) {
    if (!input) return fallback;

    return {
      label: input.value || fallback.label,
      handle: input.getAttribute('data-jkrb-shape') || input.getAttribute('data-jkrb-setting') || input.getAttribute('data-jkrb-metal') || fallback.handle,
      adjustment: parseInt(input.getAttribute('data-price-adjustment'), 10) || 0
    };
  }

  function updateSelectedCards(root) {
    root.querySelectorAll('[data-jkrb-card]').forEach(function (card) {
      var input = card.querySelector('input');
      card.classList.toggle('is-selected', Boolean(input && input.checked));
    });
  }

  function updatePreviewLayer(root, selector, attribute, handle) {
    root.querySelectorAll(selector).forEach(function (item) {
      item.classList.toggle('is-active', item.getAttribute(attribute) === handle);
    });
  }

  function modelUrlFor(root, shapeHandle) {
    return root.getAttribute('data-model-' + shapeHandle) || root.getAttribute('data-model-default') || '';
  }

  function updateModel(root, shapeHandle) {
    var model = root.querySelector('[data-jkrb-model]');
    var loading = root.querySelector('[data-jkrb-model-loading]');
    var url = modelUrlFor(root, shapeHandle);
    var hasSequenceFrames = Boolean(root.querySelector('[data-jkrb-sequence-frame]'));

    if (hasSequenceFrames) {
      root.classList.remove('jkrb--has-active-model', 'jkrb--model-loaded', 'jkrb--model-error');
      if (loading) loading.setAttribute('hidden', 'hidden');
      return;
    }

    root.classList.toggle('jkrb--has-active-model', Boolean(model && url));

    if (!model || !url) return;
    if (model.getAttribute('src') === url) return;

    root.classList.remove('jkrb--model-loaded', 'jkrb--model-error');
    if (loading) loading.removeAttribute('hidden');
    model.setAttribute('src', url);
  }

  function setSequenceFrame(root, index) {
    var frames = Array.prototype.slice.call(root.querySelectorAll('[data-jkrb-sequence-frame]'));
    if (!frames.length) return 0;

    var nextIndex = ((index % frames.length) + frames.length) % frames.length;
    frames.forEach(function (frame, frameIndex) {
      frame.classList.toggle('is-active', frameIndex === nextIndex);
    });
    root.setAttribute('data-sequence-index', String(nextIndex));
    return nextIndex;
  }

  function preloadSequenceFrames(frames) {
    frames.forEach(function (frame) {
      var img = frame.querySelector('img');
      if (!img) return;

      var preload = new Image();
      if (img.sizes) preload.sizes = img.sizes;
      if (img.srcset) preload.srcset = img.srcset;
      preload.src = img.currentSrc || img.src;
    });
  }

  function initSequence(root) {
    var stage = root.querySelector('[data-jkrb-preview-stage]');
    var viewer = root.querySelector('[data-jkrb-sequence-viewer]');
    var frames = Array.prototype.slice.call(root.querySelectorAll('[data-jkrb-sequence-frame]'));
    var activeIndex = 0;
    var dragging = false;
    var lastX = 0;
    var travel = 0;

    if (!stage) return;
    if (frames.length <= 1) root.classList.add('jkrb--single-image-mode');
    if (frames.length) {
      root.classList.add('jkrb--sequence-ready');
      root.classList.remove('jkrb--has-active-model');
      activeIndex = setSequenceFrame(root, 0);
      preloadSequenceFrames(frames);
    }

    function rotateBy(deltaX) {
      var threshold = 16;
      travel += deltaX;

      if (Math.abs(travel) < threshold) return;

      var steps = travel > 0 ? Math.floor(travel / threshold) : Math.ceil(travel / threshold);
      activeIndex = setSequenceFrame(root, activeIndex + steps);
      travel -= steps * threshold;
    }

    function setParallax(event) {
      var rect = stage.getBoundingClientRect();
      var x = ((event.clientX - rect.left) / rect.width) - 0.5;
      var y = ((event.clientY - rect.top) / rect.height) - 0.5;

      root.style.setProperty('--jkrb-parallax-x', (x * 14).toFixed(2) + 'px');
      root.style.setProperty('--jkrb-parallax-y', (y * 10).toFixed(2) + 'px');
      root.style.setProperty('--jkrb-shine-x', Math.round((x + 0.5) * 100) + '%');
      root.style.setProperty('--jkrb-shine-y', Math.round((y + 0.5) * 100) + '%');
    }

    function resetParallax() {
      if (dragging) return;
      root.style.setProperty('--jkrb-parallax-x', '0px');
      root.style.setProperty('--jkrb-parallax-y', '0px');
      root.style.setProperty('--jkrb-shine-x', '50%');
      root.style.setProperty('--jkrb-shine-y', '24%');
    }

    stage.addEventListener('pointermove', setParallax);
    stage.addEventListener('pointerleave', resetParallax);

    if (!viewer || !frames.length) return;

    if (frames.length > 1) {
      var interval = parseInt(root.getAttribute('data-sequence-interval'), 10) || 120;
      window.setInterval(function () {
        if (document.hidden) return;
        if ((root.getAttribute('data-gallery-view') || 'main') !== 'main') return;
        if (dragging) return;
        activeIndex = setSequenceFrame(root, activeIndex + 1);
      }, interval);
    }

    viewer.addEventListener('pointerdown', function (event) {
      dragging = true;
      lastX = event.clientX;
      travel = 0;
      viewer.classList.add('is-dragging');
      viewer.setPointerCapture(event.pointerId);
    });

    viewer.addEventListener('pointermove', function (event) {
      setParallax(event);
      if (!dragging) return;
      rotateBy(event.clientX - lastX);
      lastX = event.clientX;
    });

    function stopDragging(event) {
      dragging = false;
      travel = 0;
      viewer.classList.remove('is-dragging');
      if (event && viewer.hasPointerCapture(event.pointerId)) {
        viewer.releasePointerCapture(event.pointerId);
      }
    }

    viewer.addEventListener('pointerup', stopDragging);
    viewer.addEventListener('pointercancel', stopDragging);
    viewer.addEventListener('lostpointercapture', stopDragging);
  }

  function activeImage(root) {
    var view = root.getAttribute('data-gallery-view') || 'main';
    var selector = '';

    if (view === 'shape') {
      selector = '[data-jkrb-preview-shape].is-active img';
    } else if (view === 'setting') {
      selector = '[data-jkrb-preview-setting].is-active img';
    } else if (view === 'lifestyle') {
      selector = '[data-jkrb-lifestyle-panel] img';
    } else {
      selector = '[data-jkrb-sequence-frame].is-active img, [data-jkrb-preview-setting].is-active img';
    }

    return root.querySelector(selector) || root.querySelector('[data-jkrb-preview-setting].is-active img, [data-jkrb-preview-shape].is-active img, [data-jkrb-lifestyle-panel] img');
  }

  function initZoom(root) {
    var modal = root.querySelector('[data-jkrb-zoom-modal]');
    var openButton = root.querySelector('[data-jkrb-zoom-open]');
    var image = root.querySelector('[data-jkrb-zoom-image]');
    var placeholder = root.querySelector('[data-jkrb-zoom-placeholder]');
    if (!modal || !openButton || !image || !placeholder) return;

    function openModal() {
      var source = activeImage(root);
      var imageUrl = source && (source.currentSrc || source.src);

      if (imageUrl) {
        image.style.backgroundImage = 'url("' + imageUrl.replace(/"/g, '\\"') + '")';
        image.setAttribute('aria-label', source.alt || 'Joyari Krafted ring preview');
        image.hidden = false;
        placeholder.hidden = true;
      } else {
        image.style.backgroundImage = '';
        image.hidden = true;
        placeholder.hidden = false;
      }

      modal.hidden = false;
      document.documentElement.classList.add('jkrb-zoom-lock');
      openButton.setAttribute('aria-expanded', 'true');
    }

    function closeModal() {
      modal.hidden = true;
      document.documentElement.classList.remove('jkrb-zoom-lock');
      openButton.setAttribute('aria-expanded', 'false');
    }

    openButton.setAttribute('aria-expanded', 'false');
    openButton.addEventListener('click', openModal);
    root.querySelectorAll('[data-jkrb-zoom-close]').forEach(function (button) {
      button.addEventListener('click', closeModal);
    });

    document.addEventListener('keydown', function (event) {
      if (event.key === 'Escape' && !modal.hidden) closeModal();
    });
  }

  function updateLink(link, payload) {
    if (!link) return;

    try {
      var url = new URL(link.getAttribute('href') || '/pages/contact', window.location.origin);
      url.searchParams.set('ring_shape', payload.shape);
      url.searchParams.set('ring_setting', payload.setting);
      url.searchParams.set('ring_metal', payload.metal);
      url.searchParams.set('ring_carat', payload.carat);
      url.searchParams.set('ring_estimate', payload.estimatedPrice);
      link.href = url.pathname + url.search + url.hash;
    } catch (error) {
      return;
    }
  }

  function initBuilder(root) {
    var basePrice = parseInt(root.getAttribute('data-base-price'), 10) || 0;
    var baseCarat = parseFloat(root.getAttribute('data-base-carat')) || 1.5;
    var quarterPremium = parseInt(root.getAttribute('data-quarter-premium'), 10) || 0;
    var caratInput = root.querySelector('[data-jkrb-carat]');
    var model = root.querySelector('[data-jkrb-model]');
    var payloadField = root.querySelector('[data-jkrb-payload]');
    var requestLinks = root.querySelectorAll('[data-jkrb-request-link], [data-jkrb-request-link-secondary], [data-jkrb-request-link-panel], [data-jkrb-sticky-link]');
    var consultationLinks = root.querySelectorAll('[data-jkrb-consultation-link], [data-jkrb-choose-diamond-link], [data-jkrb-choose-setting-link]');

    initSequence(root);
    initZoom(root);

    if (model) {
      model.addEventListener('load', function () {
        root.classList.add('jkrb--model-loaded');
        root.classList.remove('jkrb--model-error');
      });

      model.addEventListener('error', function () {
        root.classList.add('jkrb--model-error');
        root.classList.remove('jkrb--model-loaded', 'jkrb--has-active-model');
      });
    }

    function setGalleryView(view) {
      root.setAttribute('data-gallery-view', view || 'main');

      root.querySelectorAll('[data-jkrb-gallery-thumb]').forEach(function (item) {
        item.classList.toggle('is-active', item.getAttribute('data-gallery-view') === view);
      });
    }

    root.querySelectorAll('[data-jkrb-gallery-thumb]').forEach(function (button) {
      button.addEventListener('click', function () {
        setGalleryView(button.getAttribute('data-gallery-view') || 'main');
      });
    });

    function update() {
      var shape = readChoice(checked(root, '[data-jkrb-shape]'), { label: 'Round', handle: 'round', adjustment: 0 });
      var setting = readChoice(checked(root, '[data-jkrb-setting]'), { label: 'Solitaire', handle: 'solitaire', adjustment: 0 });
      var metal = readChoice(checked(root, '[data-jkrb-metal]'), { label: 'Platinum', handle: 'platinum', adjustment: 0 });
      var carat = caratInput ? parseFloat(caratInput.value) || baseCarat : baseCarat;
      var quarters = Math.max(0, Math.round((carat - 1) / 0.25));
      var caratAdjustment = quarters * quarterPremium;
      var estimate = Math.max(0, basePrice + shape.adjustment + setting.adjustment + metal.adjustment + caratAdjustment);
      var formattedEstimate = formatMoney(estimate);
      var caratText = carat.toFixed(2) + ' ct';
      var summary = shape.label + ' ' + setting.label.toLowerCase() + ' in ' + metal.label;

      root.setAttribute('data-current-shape', shape.handle);
      root.setAttribute('data-current-setting', setting.handle);
      root.setAttribute('data-current-metal', metal.handle);

      updateSelectedCards(root);
      updatePreviewLayer(root, '[data-jkrb-preview-shape]', 'data-jkrb-preview-shape', shape.handle);
      updatePreviewLayer(root, '[data-jkrb-preview-setting]', 'data-jkrb-preview-setting', setting.handle);
      updatePreviewLayer(root, '[data-jkrb-preview-metal]', 'data-jkrb-preview-metal', metal.handle);
      updatePreviewLayer(root, '[data-jkrb-thumb-shape]', 'data-jkrb-thumb-shape', shape.handle);
      updatePreviewLayer(root, '[data-jkrb-thumb-setting]', 'data-jkrb-thumb-setting', setting.handle);
      updateModel(root, shape.handle);
      text(root, '[data-jkrb-selected-shape]', shape.label);
      text(root, '[data-jkrb-selected-setting]', setting.label);
      text(root, '[data-jkrb-selected-metal]', metal.label);
      text(root, '[data-jkrb-selected-carat]', caratText);
      text(root, '[data-jkrb-carat-output]', caratText);
      text(root, '[data-jkrb-summary]', summary);
      text(root, '[data-jkrb-summary-panel]', summary);
      text(root, '[data-jkrb-price]', formattedEstimate);
      text(root, '[data-jkrb-price-panel]', formattedEstimate);
      text(root, '[data-jkrb-sticky-price]', formattedEstimate);
      text(root, '[data-jkrb-spec-metal]', metal.label);
      text(root, '[data-jkrb-spec-shape]', shape.label);
      text(root, '[data-jkrb-spec-setting]', setting.label);

      var payload = {
        source: 'joyari-custom-ring-builder',
        apiReady: true,
        shape: shape.label,
        shapeHandle: shape.handle,
        setting: setting.label,
        settingHandle: setting.handle,
        metal: metal.label,
        metalHandle: metal.handle,
        carat: caratText,
        estimatedPrice: formattedEstimate,
        estimatedPriceCents: estimate,
        demoData: true
      };

      if (payloadField) payloadField.value = JSON.stringify(payload, null, 2);
      requestLinks.forEach(function (link) { updateLink(link, payload); });
      consultationLinks.forEach(function (link) { updateLink(link, payload); });

      window.JoyariCustomRingSelection = payload;
      root.dispatchEvent(new CustomEvent('joyari:custom-ring:update', {
        bubbles: true,
        detail: payload
      }));
    }

    root.querySelectorAll('[data-jkrb-choice]').forEach(function (input) {
      input.addEventListener('change', function () {
        if (input.hasAttribute('data-jkrb-shape')) {
          setGalleryView('shape');
        } else if (input.hasAttribute('data-jkrb-setting')) {
          setGalleryView('setting');
        } else if (input.hasAttribute('data-jkrb-metal')) {
          setGalleryView('main');
        }

        update();
      });
      input.addEventListener('input', update);
    });

    update();
  }

  function init() {
    document.querySelectorAll('[data-custom-ring-builder]').forEach(initBuilder);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
