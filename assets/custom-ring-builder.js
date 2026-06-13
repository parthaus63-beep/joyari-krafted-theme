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

  function updatePrice(root) {
    var total = parseInt(root.getAttribute('data-base-price'), 10) || 0;
    root.querySelectorAll('[data-option-button].is-selected').forEach(function (button) {
      total += parseInt(button.getAttribute('data-price'), 10) || 0;
    });
    total = Math.max(0, total);
    var formatted = formatMoney(total, root.getAttribute('data-money-format'));
    root.querySelectorAll('[data-estimate-price]').forEach(function (element) {
      element.textContent = formatted;
    });
    updateProperty(root, 'Configured Price', formatted);
  }

  function selectOption(root, button) {
    var group = button.getAttribute('data-group');
    var value = button.getAttribute('data-value');
    if (!group || !value) return;

    root.querySelectorAll('[data-option-button][data-group="' + group + '"]').forEach(function (candidate) {
      var selected = candidate === button;
      candidate.classList.toggle('is-selected', selected);
      candidate.setAttribute('aria-pressed', selected ? 'true' : 'false');
    });

    root.querySelectorAll('[data-selected-label="' + group + '"]').forEach(function (label) {
      label.textContent = value;
    });
    updateProperty(root, group, value);
    updatePrice(root);
  }

  function shareBuilder() {
    if (navigator.share) {
      navigator.share({ title: document.title, url: window.location.href }).catch(function () {});
      return;
    }
    if (navigator.clipboard) navigator.clipboard.writeText(window.location.href).catch(function () {});
  }

  function initViewer(viewer) {
    var image = viewer.querySelector('.jkb__viewer-image');
    var video = viewer.querySelector('[data-viewer-video]');
    var stage = viewer.querySelector('[data-360-stage]');
    var mediaButtons = viewer.querySelectorAll('[data-gallery-media]');
    var frames = Array.prototype.map.call(viewer.querySelectorAll('[data-360-frame]'), function (frame) {
      return frame.getAttribute('data-360-frame');
    }).filter(Boolean);
    if (!image || !stage) return;

    if (!frames.length && image.currentSrc) frames.push(image.currentSrc);
    if (!frames.length && image.src) frames.push(image.src);

    var index = 0;
    var dragging = false;
    var startX = 0;
    var lastStep = 0;
    var rotationTimer = null;
    var play = viewer.querySelector('[data-360-play]');

    function preloadFrames(start, end) {
      frames.slice(start, end).forEach(function (source) {
        var preload = new Image();
        preload.src = source;
      });
    }

    preloadFrames(0, 8);
    var loadRemaining = function () { preloadFrames(8, frames.length); };
    if ('requestIdleCallback' in window) {
      window.requestIdleCallback(loadRemaining, { timeout: 1800 });
    } else {
      window.setTimeout(loadRemaining, 900);
    }

    function showFrame(nextIndex) {
      if (!frames.length) return;
      index = (nextIndex + frames.length) % frames.length;
      viewer.classList.add('is-changing');
      image.src = frames[index];
      window.setTimeout(function () {
        viewer.classList.remove('is-changing');
      }, 90);
    }

    function moveFrame(direction) {
      showFrame(index + direction);
    }

    function stopRotation() {
      if (rotationTimer) window.clearInterval(rotationTimer);
      rotationTimer = null;
      if (play) {
        play.setAttribute('aria-pressed', 'false');
        play.setAttribute('aria-label', 'Start automatic rotation');
      }
    }

    function startRotation() {
      if (frames.length < 2) return;
      stopRotation();
      rotationTimer = window.setInterval(function () { moveFrame(1); }, 110);
      if (play) {
        play.setAttribute('aria-pressed', 'true');
        play.setAttribute('aria-label', 'Pause automatic rotation');
      }
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
      stopRotation();
      if (video) {
        video.pause();
        video.hidden = true;
        video.removeAttribute('src');
        video.load();
      }
      image.hidden = false;
      viewer.setAttribute('data-media-mode', mode || '360');

      if (mode === 'video' && video && source) {
        image.hidden = true;
        video.hidden = false;
        video.src = source;
        video.load();
      } else if (mode === 'image' && source) {
        image.src = source;
        image.alt = button.getAttribute('data-media-alt') || 'Joyari ring detail';
      } else {
        image.alt = 'Joyari ring interactive 360 view';
        showFrame(index);
      }
      setActiveMedia(button);
    }

    var previous = viewer.querySelector('[data-360-previous]');
    var next = viewer.querySelector('[data-360-next]');
    if (previous) previous.addEventListener('click', function () { stopRotation(); moveFrame(-1); });
    if (next) next.addEventListener('click', function () { stopRotation(); moveFrame(1); });
    if (play) {
      play.addEventListener('click', function () {
        if (rotationTimer) stopRotation();
        else startRotation();
      });
    }

    mediaButtons.forEach(function (button) {
      button.addEventListener('click', function () { showMedia(button); });
    });

    stage.addEventListener('pointerdown', function (event) {
      if (event.target.closest('button')) return;
      if (viewer.getAttribute('data-media-mode') !== '360') return;
      stopRotation();
      dragging = true;
      startX = event.clientX;
      lastStep = 0;
      stage.setPointerCapture(event.pointerId);
    });

    stage.addEventListener('pointermove', function (event) {
      if (!dragging || frames.length < 2) return;
      var step = Math.trunc((event.clientX - startX) / 26);
      if (step !== lastStep) {
        showFrame(index + step - lastStep);
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

    if (frames.length < 2) {
      viewer.classList.add('is-static');
      var instruction = viewer.querySelector('[data-360-instruction]');
      if (instruction) instruction.textContent = 'Interactive view';
    }

    viewer.setAttribute('data-media-mode', '360');
    showFrame(0);
  }

  function initBuilder(root) {
    root.querySelectorAll('[data-360-viewer]').forEach(initViewer);

    root.querySelectorAll('[data-option-button]').forEach(function (button) {
      button.setAttribute('aria-pressed', button.classList.contains('is-selected') ? 'true' : 'false');
      button.addEventListener('click', function () {
        selectOption(root, button);
      });
    });

    root.querySelectorAll('[data-option-button].is-selected').forEach(function (button) {
      var group = button.getAttribute('data-group');
      var value = button.getAttribute('data-value');
      updateProperty(root, group, value);
    });

    var share = root.querySelector('[data-builder-share]');
    if (share) share.addEventListener('click', shareBuilder);
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
