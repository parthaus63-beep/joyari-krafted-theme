(function () {
  'use strict';

  function formatMoney(cents, format) {
    var value = Number(cents) || 0;
    var moneyFormat = format || '${{amount}}';
    var match = moneyFormat.match(/\{\{\s*(\w+)\s*\}\}/);
    var precision = match && match[1] === 'amount_no_decimals' ? 0 : 2;
    var amount = (value / 100).toFixed(precision);
    var parts = amount.split('.');
    parts[0] = parts[0].replace(/(\d)(?=(\d\d\d)+(?!\d))/g, '$1,');
    return moneyFormat.replace(/\{\{\s*\w+\s*\}\}/, parts.join('.')).replace(/<[^>]*>/g, '');
  }

  function updateProperty(root, name, value) {
    root.querySelectorAll('[data-property-input="' + name + '"]').forEach(function (input) {
      input.value = value || '';
    });
  }

  function selectedOptionPrice(select) {
    if (!select || !select.selectedOptions || !select.selectedOptions.length) return 0;
    return parseInt(select.selectedOptions[0].getAttribute('data-price'), 10) || 0;
  }

  function updatePrice(root) {
    var total = parseInt(root.getAttribute('data-base-price'), 10) || 0;
    root.querySelectorAll('[data-option-button].is-selected').forEach(function (button) {
      total += parseInt(button.getAttribute('data-price'), 10) || 0;
    });
    root.querySelectorAll('[data-option-select]').forEach(function (select) {
      total += selectedOptionPrice(select);
    });
    total = Math.max(0, total);
    var formatted = formatMoney(total, root.getAttribute('data-money-format'));
    root.querySelectorAll('[data-estimate-price]').forEach(function (element) {
      element.textContent = formatted;
    });
    updateProperty(root, 'Configured Price', formatted);
  }

  function setSelectedLabel(root, group, value) {
    root.querySelectorAll('[data-selected-label="' + group + '"]').forEach(function (label) {
      label.textContent = value;
    });
  }

  function updateMainImage(root, source, alt) {
    var viewer = root.querySelector('[data-ring-viewer]');
    var image = root.querySelector('[data-viewer-image]');
    var video = root.querySelector('[data-viewer-video]');
    if (!viewer || !image || !source) return;

    if (video) {
      video.pause();
      video.hidden = true;
      video.removeAttribute('src');
      video.load();
    }

    viewer.setAttribute('data-media-mode', 'image');
    viewer.classList.add('is-changing');
    image.hidden = false;
    image.src = source;
    if (alt) image.alt = alt;
    window.setTimeout(function () {
      viewer.classList.remove('is-changing');
    }, 180);
  }

  function selectButton(root, button) {
    var group = button.getAttribute('data-group');
    var value = button.getAttribute('data-value');
    if (!group || !value) return;

    root.querySelectorAll('[data-option-button][data-group="' + group + '"]').forEach(function (candidate) {
      var selected = candidate === button;
      candidate.classList.toggle('is-selected', selected);
      candidate.setAttribute('aria-pressed', selected ? 'true' : 'false');
    });

    setSelectedLabel(root, group, value);
    updateProperty(root, group, value);

    if (button.matches('[data-shape-button]')) {
      updateMainImage(root, button.getAttribute('data-media-source'), value + ' diamond ring preview');
    }

    updatePrice(root);
  }

  function selectDropdown(root, select) {
    var group = select.getAttribute('data-group');
    var value = select.value;
    if (!group) return;
    setSelectedLabel(root, group, value);
    updateProperty(root, group, value);
    updatePrice(root);
  }

  function updateTextProperty(root, input) {
    var group = input.getAttribute('data-property-text');
    if (!group) return;
    updateProperty(root, group, input.value);
  }

  function shareBuilder() {
    if (navigator.share) {
      navigator.share({ title: document.title, url: window.location.href }).catch(function () {});
      return;
    }
    if (navigator.clipboard) navigator.clipboard.writeText(window.location.href).catch(function () {});
  }

  function initViewer(root, viewer) {
    var image = viewer.querySelector('[data-viewer-image]');
    var video = viewer.querySelector('[data-viewer-video]');
    var stage = viewer.querySelector('[data-viewer-stage]');
    var mediaButtons = root.querySelectorAll('[data-gallery-media]');
    var frames = Array.prototype.map.call(viewer.querySelectorAll('[data-360-frame]'), function (frame) {
      return frame.getAttribute('data-360-frame');
    }).filter(Boolean);
    if (!image || !stage) return;

    if (!frames.length && image.currentSrc) frames.push(image.currentSrc);
    if (!frames.length && image.src) frames.push(image.src);

    var frameIndex = 0;
    var dragging = false;
    var startX = 0;
    var lastStep = 0;

    function preloadFrames(start, end) {
      frames.slice(start, end).forEach(function (source) {
        var preload = new Image();
        preload.src = source;
      });
    }

    preloadFrames(0, 8);
    window.setTimeout(function () {
      preloadFrames(8, frames.length);
    }, 600);

    function showFrame(nextIndex) {
      if (!frames.length) return;
      frameIndex = (nextIndex + frames.length) % frames.length;
      viewer.classList.add('is-changing');
      image.hidden = false;
      image.src = frames[frameIndex];
      image.alt = 'Interactive ring view';
      viewer.setAttribute('data-media-mode', '360');
      if (video) {
        video.pause();
        video.hidden = true;
      }
      window.setTimeout(function () {
        viewer.classList.remove('is-changing');
      }, 120);
    }

    function moveFrame(direction) {
      showFrame(frameIndex + direction);
    }

    function setActiveMedia(button) {
      mediaButtons.forEach(function (candidate) {
        var active = candidate === button;
        candidate.classList.toggle('is-active', active);
        candidate.setAttribute('aria-pressed', active ? 'true' : 'false');
      });
    }

    function showMedia(button) {
      var mode = button.getAttribute('data-gallery-media');
      var source = button.getAttribute('data-media-source');

      if (video) {
        video.pause();
        video.hidden = true;
        video.removeAttribute('src');
        video.load();
      }

      if (mode === 'video' && video && source) {
        image.hidden = true;
        video.hidden = false;
        video.src = source;
        video.load();
        viewer.setAttribute('data-media-mode', 'video');
      } else if (mode === 'image' && source) {
        updateMainImage(root, source, button.getAttribute('data-media-alt') || 'Joyari ring detail');
      } else {
        showFrame(frameIndex);
      }
      setActiveMedia(button);
    }

    var previous = viewer.querySelector('[data-360-previous]');
    var next = viewer.querySelector('[data-360-next]');
    if (previous) previous.addEventListener('click', function () { moveFrame(-1); });
    if (next) next.addEventListener('click', function () { moveFrame(1); });

    mediaButtons.forEach(function (button) {
      button.addEventListener('click', function () { showMedia(button); });
    });

    stage.addEventListener('pointerdown', function (event) {
      if (event.target.closest('button')) return;
      if (viewer.getAttribute('data-media-mode') === 'video') return;
      dragging = true;
      startX = event.clientX;
      lastStep = 0;
      stage.setPointerCapture(event.pointerId);
    });

    stage.addEventListener('pointermove', function (event) {
      if (!dragging || frames.length < 2) return;
      var step = Math.trunc((event.clientX - startX) / 28);
      if (step !== lastStep) {
        showFrame(frameIndex + step - lastStep);
        lastStep = step;
      }
    });

    function stopDragging() {
      dragging = false;
      lastStep = 0;
    }

    stage.addEventListener('pointerup', stopDragging);
    stage.addEventListener('pointercancel', stopDragging);
    stage.addEventListener('lostpointercapture', stopDragging);

    viewer.setAttribute('data-media-mode', '360');
    showFrame(0);
  }

  function initBuilder(root) {
    root.querySelectorAll('[data-ring-viewer]').forEach(function (viewer) {
      initViewer(root, viewer);
    });

    root.querySelectorAll('[data-option-button]').forEach(function (button) {
      button.setAttribute('aria-pressed', button.classList.contains('is-selected') ? 'true' : 'false');
      button.addEventListener('click', function () {
        selectButton(root, button);
      });
    });

    root.querySelectorAll('[data-option-select]').forEach(function (select) {
      selectDropdown(root, select);
      select.addEventListener('change', function () {
        selectDropdown(root, select);
      });
    });

    root.querySelectorAll('[data-property-text]').forEach(function (input) {
      updateTextProperty(root, input);
      input.addEventListener('input', function () {
        updateTextProperty(root, input);
      });
    });

    root.querySelectorAll('[data-option-button].is-selected').forEach(function (button) {
      updateProperty(root, button.getAttribute('data-group'), button.getAttribute('data-value'));
    });

    var share = root.querySelector('[data-builder-share]');
    if (share) share.addEventListener('click', shareBuilder);

    var mobileSubmit = root.querySelector('[data-mobile-builder-submit]');
    if (mobileSubmit) {
      mobileSubmit.addEventListener('click', function () {
        var primaryAction = root.querySelector('.jkb__primary-cta');
        if (primaryAction) primaryAction.click();
      });
    }

    updatePrice(root);
  }

  function initAll() {
    document.querySelectorAll('[data-custom-ring-builder]').forEach(initBuilder);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initAll);
  } else {
    initAll();
  }
})();
