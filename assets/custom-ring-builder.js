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
    var stage = viewer.querySelector('[data-360-stage]');
    var frames = Array.prototype.map.call(viewer.querySelectorAll('[data-360-frame]'), function (frame) {
      return frame.getAttribute('data-360-frame');
    }).filter(Boolean);
    if (!image || !stage) return;

    if (!frames.length && image.currentSrc) frames.push(image.currentSrc);
    if (!frames.length && image.src) frames.push(image.src);

    frames.forEach(function (source) {
      var preload = new Image();
      preload.src = source;
    });

    var index = 0;
    var dragging = false;
    var startX = 0;
    var lastStep = 0;

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

    var previous = viewer.querySelector('[data-360-previous]');
    var next = viewer.querySelector('[data-360-next]');
    if (previous) previous.addEventListener('click', function () { moveFrame(-1); });
    if (next) next.addEventListener('click', function () { moveFrame(1); });

    stage.addEventListener('pointerdown', function (event) {
      if (event.target.closest('button')) return;
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
