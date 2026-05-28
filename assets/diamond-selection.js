(function () {
  'use strict';

  var STORAGE_KEY = 'joyariSelectedDiamond';

  var mockDiamonds = [
    {
      id: 'mock-round-150-d-vs1-igi',
      shape: 'Round',
      carat: 1.5,
      colour: 'D',
      clarity: 'VS1',
      cut: 'Excellent',
      type: 'Lab Grown',
      certificateLab: 'IGI',
      certificateNumber: 'JK-LG-15001',
      priceLabel: 'Price available after review',
      budgetGuide: 7800
    },
    {
      id: 'mock-oval-180-e-vvs2-gia',
      shape: 'Oval',
      carat: 1.8,
      colour: 'E',
      clarity: 'VVS2',
      cut: 'Excellent',
      type: 'Lab Grown',
      certificateLab: 'GIA',
      certificateNumber: 'JK-LG-18024',
      priceLabel: 'Private quote',
      budgetGuide: 9800
    },
    {
      id: 'mock-emerald-140-f-vs1-gcal',
      shape: 'Emerald',
      carat: 1.4,
      colour: 'F',
      clarity: 'VS1',
      cut: 'Ideal',
      type: 'Lab Grown',
      certificateLab: 'GCAL',
      certificateNumber: 'JK-LG-14077',
      priceLabel: 'Price available after review',
      budgetGuide: 7200
    },
    {
      id: 'mock-pear-120-d-vvs1-igi',
      shape: 'Pear',
      carat: 1.2,
      colour: 'D',
      clarity: 'VVS1',
      cut: 'Excellent',
      type: 'Natural',
      certificateLab: 'IGI',
      certificateNumber: 'JK-NT-12018',
      priceLabel: 'Private quote',
      budgetGuide: 11200
    },
    {
      id: 'mock-cushion-205-g-vs2-gia',
      shape: 'Cushion',
      carat: 2.05,
      colour: 'G',
      clarity: 'VS2',
      cut: 'Very Good',
      type: 'Lab Grown',
      certificateLab: 'GIA',
      certificateNumber: 'JK-LG-20542',
      priceLabel: 'Price available after review',
      budgetGuide: 10400
    },
    {
      id: 'mock-marquise-110-e-vs1-hrd',
      shape: 'Marquise',
      carat: 1.1,
      colour: 'E',
      clarity: 'VS1',
      cut: 'Excellent',
      type: 'Natural',
      certificateLab: 'HRD',
      certificateNumber: 'JK-NT-11009',
      priceLabel: 'Private quote',
      budgetGuide: 8900
    }
  ];

  function normaliseDiamond(raw) {
    return {
      id: String(raw.id || raw.diamond_id || raw.stockNumber || raw.certificateNumber || Date.now()),
      shape: raw.shape || raw.diamondShape || 'Round',
      carat: Number(raw.carat || raw.caratWeight || raw.size || 0),
      colour: raw.colour || raw.color || '-',
      clarity: raw.clarity || '-',
      cut: raw.cut || raw.cutGrade || '-',
      type: raw.type || raw.origin || raw.growthType || 'Lab Grown',
      certificateLab: raw.certificateLab || raw.certLab || raw.lab || '-',
      certificateNumber: raw.certificateNumber || raw.certNumber || raw.certificate || '-',
      priceLabel: raw.priceLabel || raw.price_label || 'Price available after review',
      budgetGuide: Number(raw.budgetGuide || raw.price || raw.priceAmount || 0),
      imageUrl: raw.imageUrl || raw.image_url || raw.image || '',
      videoUrl: raw.videoUrl || raw.video_url || raw.video || ''
    };
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
    var filters = {
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

    return filters;
  }

  function toQuery(filters) {
    var params = new URLSearchParams();

    filters.shapes.forEach(function (shape) {
      params.append('shape', shape);
    });

    if (filters.caratMin !== null) params.set('carat_min', filters.caratMin);
    if (filters.caratMax !== null) params.set('carat_max', filters.caratMax);
    if (filters.colour) params.set('colour', filters.colour);
    if (filters.clarity) params.set('clarity', filters.clarity);
    if (filters.cut) params.set('cut', filters.cut);
    if (filters.type) params.set('type', filters.type);
    if (filters.certificateLab) params.set('certificate_lab', filters.certificateLab);
    if (filters.priceMin !== null) params.set('price_min', filters.priceMin);
    if (filters.priceMax !== null) params.set('price_max', filters.priceMax);
    if (filters.sort) params.set('sort', filters.sort);

    return params;
  }

  function filterMockDiamonds(filters) {
    var results = mockDiamonds.filter(function (diamond) {
      if (filters.shapes.length && !filters.shapes.includes(diamond.shape)) return false;
      if (filters.caratMin !== null && diamond.carat < filters.caratMin) return false;
      if (filters.caratMax !== null && diamond.carat > filters.caratMax) return false;
      if (filters.colour && diamond.colour !== filters.colour) return false;
      if (filters.clarity && diamond.clarity !== filters.clarity) return false;
      if (filters.cut && diamond.cut !== filters.cut) return false;
      if (filters.type && diamond.type !== filters.type) return false;
      if (filters.certificateLab && diamond.certificateLab !== filters.certificateLab) return false;
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
        return String(a.colour + a.clarity).localeCompare(String(b.colour + b.clarity));
      });
    }

    return results;
  }

  function extractDiamonds(payload) {
    if (Array.isArray(payload)) return payload;
    if (payload && Array.isArray(payload.diamonds)) return payload.diamonds;
    if (payload && Array.isArray(payload.results)) return payload.results;
    if (payload && Array.isArray(payload.data)) return payload.data;
    return [];
  }

  function createPlaceholder(shape) {
    var placeholder = document.createElement('span');
    placeholder.className = 'jk-diamond-placeholder jk-diamond-placeholder--' + String(shape || 'round').toLowerCase().replace(/\s+/g, '-');
    placeholder.setAttribute('aria-hidden', 'true');
    return placeholder;
  }

  function renderMedia(container, diamond) {
    container.textContent = '';

    if (diamond.videoUrl) {
      var video = document.createElement('video');
      video.src = diamond.videoUrl;
      video.muted = true;
      video.loop = true;
      video.playsInline = true;
      video.controls = true;
      container.appendChild(video);
      return;
    }

    if (diamond.imageUrl) {
      var image = document.createElement('img');
      image.src = diamond.imageUrl;
      image.alt = diamond.shape + ' diamond';
      image.loading = 'lazy';
      container.appendChild(image);
      return;
    }

    container.appendChild(createPlaceholder(diamond.shape));
  }

  function setText(scope, selector, value) {
    var element = scope.querySelector(selector);
    if (element) element.textContent = value;
  }

  function renderDiamonds(root, diamonds) {
    var grid = root.querySelector('[data-diamond-results]');
    var template = root.querySelector('[data-diamond-card-template]');
    var stored = getStoredDiamond();
    grid.textContent = '';

    if (!diamonds.length) {
      var empty = document.createElement('div');
      empty.className = 'jk-diamond-empty';
      empty.innerHTML = '<p class="jk-diamond-select__eyebrow">No diamonds found</p><h3>Refine your filters</h3><p>Try widening shape, carat, colour, clarity, origin, certificate lab, or budget guidance.</p>';
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
      setText(fragment, '[data-diamond-carat]', diamond.carat.toFixed(2));
      setText(fragment, '[data-diamond-shape]', diamond.shape);
      setText(fragment, '[data-diamond-colour]', diamond.colour);
      setText(fragment, '[data-diamond-clarity]', diamond.clarity);
      setText(fragment, '[data-diamond-cut]', diamond.cut);
      setText(fragment, '[data-diamond-lab]', diamond.certificateLab);
      setText(fragment, '[data-diamond-certificate]', 'Certificate ' + diamond.certificateLab + ' · ' + diamond.certificateNumber);

      selectButton.addEventListener('click', function () {
        saveDiamond(root, diamond);
        root.querySelectorAll('.jk-diamond-card').forEach(function (item) {
          item.classList.toggle('is-selected', item.dataset.diamondId === diamond.id);
          var button = item.querySelector('[data-select-diamond]');
          if (button) button.textContent = item.dataset.diamondId === diamond.id ? 'Selected' : 'Select Diamond';
        });
      });

      grid.appendChild(fragment);
    });
  }

  function getStoredDiamond() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
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
    setText(panel, '[data-selected-diamond-title]', diamond.carat.toFixed(2) + 'ct ' + diamond.shape + ' Diamond');
    setText(panel, '[data-selected-diamond-meta]', [
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
    localStorage.setItem(STORAGE_KEY, JSON.stringify(diamond));
    updateSelectedPanel(root, diamond);
  }

  function setStatus(root, message) {
    setText(root, '[data-diamond-status]', message);
  }

  function setCount(root, count) {
    setText(root, '[data-diamond-result-count]', count + (count === 1 ? ' diamond' : ' diamonds'));
  }

  function searchDiamonds(root) {
    var form = root.querySelector('[data-diamond-filter-form]');
    var endpoint = root.getAttribute('data-endpoint') || '/apps/diamonds/search';
    var filters = getFilters(form);
    var query = toQuery(filters);
    var url = endpoint + (endpoint.indexOf('?') === -1 ? '?' : '&') + query.toString();

    root.classList.add('is-loading');
    setStatus(root, 'Searching private diamond inventory.');

    fetch(url, {
      headers: {
        Accept: 'application/json'
      }
    })
      .then(function (response) {
        if (!response.ok) throw new Error('Diamond backend unavailable');
        return response.json();
      })
      .then(function (payload) {
        var diamonds = extractDiamonds(payload).map(normaliseDiamond);
        root.classList.remove('is-loading');
        setStatus(root, 'Live diamond search results.');
        setCount(root, diamonds.length);
        renderDiamonds(root, diamonds);
      })
      .catch(function () {
        var mockResults = filterMockDiamonds(filters).map(normaliseDiamond);
        root.classList.remove('is-loading');
        setStatus(root, 'Demo diamonds shown while live diamond search connects.');
        setCount(root, mockResults.length);
        renderDiamonds(root, mockResults);
      });
  }

  function initDiamondSelection(root) {
    var form = root.querySelector('[data-diamond-filter-form]');
    if (!form) return;

    var stored = getStoredDiamond();
    updateSelectedPanel(root, stored);

    var debouncedSearch = debounce(function () {
      searchDiamonds(root);
    }, 280);

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
