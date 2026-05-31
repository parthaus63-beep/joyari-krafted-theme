(function () {
  'use strict';

  var STORAGE_KEY = 'joyariSelectedDiamond';
  var UNAVAILABLE_MESSAGE = 'Diamond inventory is temporarily unavailable. Please contact us for live diamond options.';
  var FALLBACK_LOADED_MESSAGE = 'Certified diamond inventory loaded from Joyari secure feed.';

  var SHAPE_MAP = {
    RD: 'Round',
    ROUND: 'Round',
    OV: 'Oval',
    OVAL: 'Oval',
    PR: 'Pear',
    PEAR: 'Pear',
    EM: 'Emerald',
    EMERALD: 'Emerald',
    CU: 'Cushion',
    CUSHION: 'Cushion',
    PS: 'Princess',
    PRINCESS: 'Princess',
    MQ: 'Marquise',
    MARQUISE: 'Marquise',
    RAD: 'Radiant',
    RADIANT: 'Radiant',
    HT: 'Heart',
    HEART: 'Heart',
    AS: 'Asscher',
    ASSCHER: 'Asscher'
  };

  var CUT_MAP = {
    EX: 'Excellent',
    ID: 'Ideal',
    I: 'Ideal',
    VG: 'Very Good',
    GD: 'Good',
    G: 'Good',
    FR: 'Fair',
    N: '-',
    'N/A': '-'
  };

  function clean(value, fallback) {
    if (value === null || value === undefined) return fallback || '';
    var text = String(value).trim();
    return text || fallback || '';
  }

  function parseNumber(value) {
    if (value === null || value === undefined || value === '') return 0;
    var number = Number(String(value).replace(/,/g, ''));
    return Number.isFinite(number) ? number : 0;
  }

  function titleCase(value) {
    return clean(value).toLowerCase().replace(/\b\w/g, function (character) {
      return character.toUpperCase();
    });
  }

  function normaliseShape(value) {
    var key = clean(value).toUpperCase().replace(/\s+/g, '_');
    return SHAPE_MAP[key] || titleCase(value || 'Round');
  }

  function normaliseCut(value) {
    var key = clean(value).toUpperCase();
    return CUT_MAP[key] || clean(value, '-');
  }

  function normaliseColour(raw) {
    var colour = clean(raw.colour || raw.color);
    var fancy = [
      clean(raw.fancy_color_intensity),
      clean(raw.fancy_color_overtone),
      clean(raw.fancy_color)
    ].filter(Boolean).join(' ');

    return colour || fancy || '-';
  }

  function formatPrice(amount) {
    if (!amount) return 'Price on request';
    return 'US$' + amount.toLocaleString(undefined, {
      minimumFractionDigits: amount % 1 ? 2 : 0,
      maximumFractionDigits: 2
    });
  }

  function normaliseDiamond(raw) {
    var price = parseNumber(raw.total_sales_price || raw.price || raw.priceAmount || raw.price_per_cara);
    var stockId = clean(raw.stock_num || raw.stockNumber || raw.stock_id || raw.id || raw.diamond_id);
    var certificateNumber = clean(raw.cert_num || raw.certificateNumber || raw.certNumber || raw.certificate, '-');
    var diamondType = clean(raw.type || raw.origin || raw.DiamondType || raw.treatment, 'Lab Grown');
    var availability = clean(raw.availability || raw.status, 'Available');

    return {
      id: String(stockId || certificateNumber || Date.now()),
      stockId: stockId || '-',
      shape: normaliseShape(raw.shape || raw.diamondShape),
      carat: parseNumber(raw.carat || raw.caratWeight || raw.size),
      colour: normaliseColour(raw),
      clarity: clean(raw.clarity, '-'),
      cut: normaliseCut(raw.cut || raw.cutGrade),
      type: diamondType.toUpperCase() === 'NATURAL' ? 'Natural' : 'Lab Grown',
      certificateLab: clean(raw.certificateLab || raw.certLab || raw.lab, '-'),
      certificateNumber: certificateNumber,
      priceLabel: clean(raw.priceLabel || raw.price_label) || formatPrice(price),
      budgetGuide: price,
      imageUrl: clean(raw.imageUrl || raw.image_url || raw.image),
      videoUrl: clean(raw.videoUrl || raw.video_url || raw.video),
      certificateUrl: clean(raw.certificateUrl || raw.cert_url || raw.certificate_url),
      availability: availability
    };
  }

  function extractDiamonds(payload) {
    if (Array.isArray(payload)) return payload;
    if (payload && Array.isArray(payload.diamonds)) return payload.diamonds;
    if (payload && Array.isArray(payload.items)) return payload.items;
    if (payload && Array.isArray(payload.results)) return payload.results;
    if (payload && Array.isArray(payload.data)) return payload.data;
    if (payload && payload.data && Array.isArray(payload.data.diamonds)) return payload.data.diamonds;
    if (payload && payload.data && Array.isArray(payload.data.items)) return payload.data.items;
    if (payload && payload.result && Array.isArray(payload.result.diamonds)) return payload.result.diamonds;
    if (payload && payload.response && Array.isArray(payload.response.diamonds)) return payload.response.diamonds;
    return [];
  }

  function debounce(fn, wait) {
    var timeout;
    return function () {
      var args = arguments;
      clearTimeout(timeout);
      timeout = setTimeout(function () {
        fn.apply(null, args);
      }, wait);
    };
  }

  function getFilters(form) {
    var formData = new FormData(form);

    return {
      shapes: formData.getAll('shape'),
      caratMin: parseFloat(formData.get('carat_min')) || null,
      caratMax: parseFloat(formData.get('carat_max')) || null,
      colour: formData.get('colour') || '',
      clarity: formData.get('clarity') || '',
      cut: formData.get('cut') || '',
      type: formData.get('type') || '',
      certificateLab: formData.get('certificate_lab') || '',
      priceMin: parseFloat(formData.get('price_min')) || null,
      priceMax: parseFloat(formData.get('price_max')) || null,
      sort: formData.get('sort') || 'recommended'
    };
  }

  function includesText(value, expected) {
    return String(value || '').toLowerCase() === String(expected || '').toLowerCase();
  }

  function filterDiamonds(diamonds, filters) {
    var results = diamonds.filter(function (diamond) {
      if (filters.shapes.length && !filters.shapes.some(function (shape) { return includesText(diamond.shape, shape); })) return false;
      if (filters.caratMin !== null && diamond.carat < filters.caratMin) return false;
      if (filters.caratMax !== null && diamond.carat > filters.caratMax) return false;
      if (filters.colour && !includesText(diamond.colour, filters.colour)) return false;
      if (filters.clarity && !includesText(diamond.clarity, filters.clarity)) return false;
      if (filters.cut && !includesText(diamond.cut, filters.cut)) return false;
      if (filters.type && !includesText(diamond.type, filters.type)) return false;
      if (filters.certificateLab && !includesText(diamond.certificateLab, filters.certificateLab)) return false;
      if (filters.priceMin !== null && diamond.budgetGuide < filters.priceMin) return false;
      if (filters.priceMax !== null && diamond.budgetGuide > filters.priceMax) return false;
      return true;
    });

    if (filters.sort === 'carat_desc') {
      results.sort(function (a, b) { return b.carat - a.carat; });
    } else if (filters.sort === 'carat_asc') {
      results.sort(function (a, b) { return a.carat - b.carat; });
    } else if (filters.sort === 'quality') {
      results.sort(function (a, b) {
        return String(a.colour + a.clarity + a.cut).localeCompare(String(b.colour + b.clarity + b.cut));
      });
    }

    return results;
  }

  function createPlaceholder(shape) {
    var placeholder = document.createElement('span');
    placeholder.className = 'jk-diamond-placeholder jk-diamond-placeholder--' + String(shape || 'round').toLowerCase().replace(/\s+/g, '-');
    placeholder.setAttribute('aria-hidden', 'true');
    return placeholder;
  }

  function isDirectVideo(url) {
    return /\.(mp4|webm|ogg|mov)(\?|#|$)/i.test(url);
  }

  function renderMedia(container, diamond) {
    container.textContent = '';

    if (diamond.imageUrl) {
      var image = document.createElement('img');
      image.src = diamond.imageUrl;
      image.alt = diamond.shape + ' diamond';
      image.loading = 'lazy';
      container.appendChild(image);
      return;
    }

    if (diamond.videoUrl && isDirectVideo(diamond.videoUrl)) {
      var video = document.createElement('video');
      video.src = diamond.videoUrl;
      video.muted = true;
      video.loop = true;
      video.playsInline = true;
      video.controls = true;
      video.preload = 'metadata';
      container.appendChild(video);
      return;
    }

    if (diamond.videoUrl) {
      var iframe = document.createElement('iframe');
      iframe.src = diamond.videoUrl;
      iframe.loading = 'lazy';
      iframe.title = diamond.shape + ' diamond video';
      iframe.setAttribute('allowfullscreen', 'true');
      container.appendChild(iframe);
      return;
    }

    container.appendChild(createPlaceholder(diamond.shape));
  }

  function setText(scope, selector, value) {
    var element = scope.querySelector(selector);
    if (element) element.textContent = value;
  }

  function renderUnavailable(root) {
    var grid = root.querySelector('[data-diamond-results]');
    if (!grid) return;

    grid.textContent = '';
    var empty = document.createElement('div');
    empty.className = 'jk-diamond-empty jk-diamond-empty--unavailable';
    empty.innerHTML = '<p class="jk-diamond-select__eyebrow">Live inventory unavailable</p><h3>Diamond inventory is temporarily unavailable</h3><p>Please contact us for live diamond options.</p>';
    grid.appendChild(empty);
  }

  function renderDiamonds(root, diamonds) {
    var grid = root.querySelector('[data-diamond-results]');
    var template = root.querySelector('[data-diamond-card-template]');
    var stored = getStoredDiamond();
    if (!grid || !template) return;

    grid.textContent = '';

    if (!diamonds.length) {
      var empty = document.createElement('div');
      empty.className = 'jk-diamond-empty';
      empty.innerHTML = '<p class="jk-diamond-select__eyebrow">No diamonds found</p><h3>Refine your filters</h3><p>Try widening shape, carat, colour, clarity, certificate lab, or budget guidance.</p>';
      grid.appendChild(empty);
      return;
    }

    diamonds.forEach(function (diamond) {
      var fragment = template.content.cloneNode(true);
      var card = fragment.querySelector('.jk-diamond-card');
      var selectButton = fragment.querySelector('[data-select-diamond]');

      card.dataset.diamondId = diamond.id;
      if (stored && stored.id === diamond.id) {
        card.classList.add('is-selected');
        selectButton.textContent = 'Selected';
      }

      renderMedia(fragment.querySelector('[data-diamond-media]'), diamond);
      setText(fragment, '[data-diamond-type]', diamond.type);
      setText(fragment, '[data-diamond-price]', diamond.priceLabel);
      setText(fragment, '[data-diamond-title]', diamond.carat.toFixed(2) + 'ct ' + diamond.shape + ' Diamond');
      setText(fragment, '[data-diamond-stock]', diamond.stockId);
      setText(fragment, '[data-diamond-carat]', diamond.carat.toFixed(2));
      setText(fragment, '[data-diamond-shape]', diamond.shape);
      setText(fragment, '[data-diamond-colour]', diamond.colour);
      setText(fragment, '[data-diamond-clarity]', diamond.clarity);
      setText(fragment, '[data-diamond-cut]', diamond.cut);
      setText(fragment, '[data-diamond-lab]', diamond.certificateLab);
      setText(fragment, '[data-diamond-availability]', diamond.availability);

      var certificate = fragment.querySelector('[data-diamond-certificate]');
      if (certificate) {
        certificate.textContent = 'Certificate ' + diamond.certificateLab + ' · ' + diamond.certificateNumber;
        if (diamond.certificateUrl) {
          var link = document.createElement('a');
          link.href = diamond.certificateUrl;
          link.target = '_blank';
          link.rel = 'noopener noreferrer';
          link.textContent = 'View certificate';
          certificate.appendChild(document.createTextNode(' · '));
          certificate.appendChild(link);
        }
      }

      selectButton.addEventListener('click', function () {
        saveDiamond(root, diamond);
        root.classList.add('has-selected-diamond');
        root.querySelectorAll('.jk-diamond-card').forEach(function (item) {
          item.classList.toggle('is-selected', item.dataset.diamondId === diamond.id);
          var button = item.querySelector('[data-select-diamond]');
          if (button) button.textContent = item.dataset.diamondId === diamond.id ? 'Selected' : 'Select Diamond';
        });
        setStatus(root, 'Diamond selected. Continue to choose your ring setting.');

        var selectedPanel = root.querySelector('[data-selected-diamond-panel]');
        if (selectedPanel && typeof selectedPanel.scrollIntoView === 'function') {
          selectedPanel.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      });

      grid.appendChild(fragment);
    });
  }

  function getStoredDiamond() {
    try {
      var storage = window.localStorage;
      if (!storage) return null;

      var raw = storage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (error) {
      return null;
    }
  }

  function updateSelectedPanel(root, diamond) {
    var panel = root.querySelector('[data-selected-diamond-panel]');
    var continueButton = root.querySelector('[data-continue-setting]');
    if (!panel || !continueButton) return;

    if (!diamond) {
      panel.hidden = true;
      continueButton.classList.add('is-disabled');
      continueButton.setAttribute('aria-disabled', 'true');
      return;
    }

    panel.hidden = false;
    root.classList.add('has-selected-diamond');
    setText(panel, '[data-selected-diamond-title]', diamond.carat.toFixed(2) + 'ct ' + diamond.shape + ' Diamond');
    setText(panel, '[data-selected-diamond-meta]', [
      'Stock ' + diamond.stockId,
      diamond.type,
      diamond.colour + ' colour',
      diamond.clarity + ' clarity',
      diamond.cut + ' cut',
      diamond.certificateLab + ' ' + diamond.certificateNumber
    ].join(' · '));
    continueButton.classList.remove('is-disabled');
    continueButton.setAttribute('aria-disabled', 'false');
  }

  function saveDiamond(root, diamond) {
    try {
      if (window.localStorage) {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(diamond));
      }
    } catch (error) {
      // Selection still updates visually if browser storage is unavailable.
    }

    window.JoyariSelectedDiamond = diamond;
    updateSelectedPanel(root, diamond);
  }

  function setStatus(root, message) {
    setText(root, '[data-diamond-status]', message);
  }

  function setCount(root, count) {
    setText(root, '[data-diamond-result-count]', count + (count === 1 ? ' diamond' : ' diamonds'));
  }

  function getEndpoint(root) {
    return clean(root.getAttribute('data-endpoint'), '/apps/diamonds/search');
  }

  function getFallbackFeed(root) {
    return clean(root.getAttribute('data-fallback-feed'));
  }

  function endpointIsMixedContent(endpoint) {
    return window.location.protocol === 'https:' && /^http:\/\//i.test(endpoint);
  }

  function diamondsFromPayload(payload) {
    return extractDiamonds(payload).map(normaliseDiamond).filter(function (diamond) {
      return diamond.stockId !== '-' || diamond.certificateNumber !== '-';
    });
  }

  function fetchJson(url) {
    return fetch(url, {
      headers: {
        Accept: 'application/json'
      }
    }).then(function (response) {
      if (!response.ok) throw new Error('Diamond backend unavailable: ' + response.status);
      return response.json();
    });
  }

  function loadFallbackDiamonds(root, originalError) {
    var fallbackFeed = getFallbackFeed(root);

    if (!fallbackFeed) {
      return Promise.reject(originalError || new Error('No diamond fallback feed configured.'));
    }

    return fetchJson(fallbackFeed)
      .then(function (payload) {
        root._joyariDiamondSource = 'fallback';
        return diamondsFromPayload(payload);
      })
      .catch(function (fallbackError) {
        if (originalError && window.console && console.warn) {
          console.warn('Joyari diamond app proxy failed before fallback.', originalError);
        }
        throw fallbackError;
      });
  }

  function loadDiamonds(root) {
    if (root._joyariDiamondPromise) return root._joyariDiamondPromise;

    var endpoint = getEndpoint(root);

    // Temporary supplier URLs that contain API keys should be called by a private app proxy.
    // Shopify storefront JavaScript cannot safely fetch an http API from an https page.
    if (!endpoint || endpointIsMixedContent(endpoint)) {
      root._joyariDiamondPromise = loadFallbackDiamonds(root, new Error('Diamond endpoint must be proxied over HTTPS.'));
      return root._joyariDiamondPromise;
    }

    root._joyariDiamondPromise = fetchJson(endpoint)
      .then(function (payload) {
        root._joyariDiamondSource = 'proxy';
        return diamondsFromPayload(payload);
      })
      .catch(function (error) {
        if (window.console && console.warn) {
          console.warn('Joyari diamond app proxy unavailable. Loading storefront feed fallback.', error);
        }
        return loadFallbackDiamonds(root, error);
      });

    return root._joyariDiamondPromise;
  }

  function searchDiamonds(root) {
    var form = root.querySelector('[data-diamond-filter-form]');
    if (!form) return;

    var filters = getFilters(form);
    root.classList.add('is-loading');
    setStatus(root, 'Loading live certified lab-grown diamonds.');

    loadDiamonds(root)
      .then(function (diamonds) {
        var filtered = filterDiamonds(diamonds, filters);
        var loadedMessage = root._joyariDiamondSource === 'fallback' ? FALLBACK_LOADED_MESSAGE : 'Live diamond inventory loaded.';
        root.classList.remove('is-loading');
        root.classList.remove('is-unavailable');
        setStatus(root, filtered.length ? loadedMessage : 'No diamonds match the current filters.');
        setCount(root, filtered.length);
        renderDiamonds(root, filtered);
      })
      .catch(function (error) {
        root.classList.remove('is-loading');
        root.classList.add('is-unavailable');
        setStatus(root, UNAVAILABLE_MESSAGE);
        setCount(root, 0);
        renderUnavailable(root);
        if (window.console && console.warn) {
          console.warn('Joyari diamond inventory unavailable.', error);
        }
      });
  }

  function defaultToLabGrown(form) {
    var typeSelect = form.querySelector('select[name="type"]');
    if (!typeSelect || typeSelect.value) return;

    var params = new URLSearchParams(window.location.search);
    if (!params.has('activeTab') && !params.has('queryLabGrown')) {
      typeSelect.value = 'Lab Grown';
      return;
    }

    if (String(params.get('activeTab') || '').toLowerCase().indexOf('lab') !== -1 || params.get('queryLabGrown') === 'true') {
      typeSelect.value = 'Lab Grown';
    }
  }

  function initDiamondSelection(root) {
    var form = root.querySelector('[data-diamond-filter-form]');
    if (!form) return;

    defaultToLabGrown(form);
    updateSelectedPanel(root, getStoredDiamond());

    var debouncedSearch = debounce(function () {
      searchDiamonds(root);
    }, 220);

    form.addEventListener('submit', function (event) {
      event.preventDefault();
      searchDiamonds(root);
    });

    form.addEventListener('input', debouncedSearch);
    form.addEventListener('change', debouncedSearch);

    var reset = root.querySelector('[data-diamond-reset]');
    if (reset) {
      reset.addEventListener('click', function () {
        form.reset();
        defaultToLabGrown(form);
        searchDiamonds(root);
      });
    }

    var continueButton = root.querySelector('[data-continue-setting]');
    if (continueButton) {
      continueButton.addEventListener('click', function (event) {
        if (!getStoredDiamond()) {
          event.preventDefault();
        }
      });
    }

    searchDiamonds(root);
  }

  document.addEventListener('DOMContentLoaded', function () {
    document.querySelectorAll('[data-diamond-selection]').forEach(initDiamondSelection);
  });
})();
