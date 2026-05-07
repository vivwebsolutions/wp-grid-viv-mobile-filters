(function($){
	window.vivgb_mbf_grids = window.vivgb_mbf_grids || {};

	var activeGridId = null;
	var gridStates   = {};

	function getState(id) {
		if (!gridStates[id]) {
			gridStates[id] = {
				wpgb:              null,
				lastFacets:        null,
				savedFacetParents: [],
				facetsInMobile:    false,
				sortSlug:          '',
				oldWidth:          $(document).width()
			};
		}
		return gridStates[id];
	}

	// ---- Open popup ----------------------------------------------------------

	$(document).on('click', '.filter-mob-but-w > button, .vivgb-show-mob-filters', function(){
		var $bar   = $(this).closest('.filter-mob-but-w');
		var gridId = parseInt($bar.data('grid') || $(this).data('grid'), 10);
		if (!gridId) return;

		// Return previous grid's facets before loading new ones
		if (activeGridId && activeGridId !== gridId) {
			returnFacetsToGrid(activeGridId);
		}
		activeGridId = gridId;
		moveFacetsToMobile(getState(gridId).lastFacets, gridId);
		// Show stored result count immediately (fetched may have fired before popup was opened)
		var _st = getState(gridId);
		if (_st.allCount !== undefined) {
			$('#mobile-bot-filter-r .search-count').text(_st.allCount);
		}
		$('#vivgb-mbf-popup').css('display', 'flex').hide().fadeIn(300);
		$('body').addClass('noscroll');
	});

	// ---- Close popup ---------------------------------------------------------

	$(document).on('click', '#mob-filter-close, #mob-show-res', function(){
		$('#vivgb-mbf-popup').fadeOut();
		$('body').removeClass('noscroll');
		if (activeGridId) {
			var st = getState(activeGridId);
			if (st.wpgb) st.wpgb.grid.layout();
		}
	});

	// ---- Facet movement ------------------------------------------------------

	var skip = ['load_more', 'result_count', 'reset', 'sort', 'viv_view_toggle', 'pagination'];

	function moveFacetsToMobile(facets, gridId) {
		if (!facets) return;
		var state = getState(gridId);
		if (state.facetsInMobile) return;

		var extraSkip  = (typeof window.viv_mbf_skip_facets !== 'undefined' && Array.isArray(window.viv_mbf_skip_facets))
			? window.viv_mbf_skip_facets : [];
		var skipAll    = skip.concat(extraSkip);
		var facetsArr  = [];
		var saveParents = state.savedFacetParents.length === 0;

		$('#vivgb-mbf-scroll').empty();
		$('#mbf-selection').empty();

		for (var key in facets) {
			var f = facets[key][0];
			if (skipAll.indexOf(f.type) !== -1) continue;
			if (saveParents) {
				state.savedFacetParents.push({el: f.holder, parent: $(f.holder).parent(), next: f.holder.nextSibling});
			}
			if (f.type === 'selection') {
				$('#mbf-selection').append(f.holder);
			} else {
				if (f.order !== undefined && f.order !== null) {
					facetsArr[f.order] = f.holder;
				} else {
					facetsArr.push(f.holder);
				}
			}
		}
		// Sort savedFacetParents by original DOM order (needed for correct restoration)
		if (saveParents && state.savedFacetParents.length > 1) {
			state.savedFacetParents.sort(function(a, b) {
				var pos = a.el.compareDocumentPosition(b.el);
				return (pos & Node.DOCUMENT_POSITION_FOLLOWING) ? -1 : 1;
			});
		}
		$('#vivgb-mbf-scroll').append(facetsArr);
		state.facetsInMobile = true;
	}

	function returnFacetsToGrid(gridId) {
		var state = getState(gridId);
		if (!state.facetsInMobile) return;
		// Restore in reverse DOM order so insertBefore targets are already in place
		state.savedFacetParents.slice().reverse().forEach(function(item){
			if (item.next) {
				item.parent[0].insertBefore(item.el, item.next);
			} else {
				item.parent.append(item.el);
			}
		});
		state.facetsInMobile = false;
	}

	// ---- Reset ---------------------------------------------------------------

	$(document).on('click', '.reset-all', function(){
		if ($(this).hasClass('disabled')) return;
		if (!activeGridId) return;
		var st = getState(activeGridId);
		if (st.wpgb) st.wpgb.facets.reset();
	});

	// ---- Per-grid init -------------------------------------------------------

	window.addEventListener('wpgb.loaded', function(){
		$.each(vivgb_mbf_grids, function(gridId, config){
			initGrid(parseInt(gridId, 10), config);
		});
	});

	function initGrid(gridId, config) {
		var state      = getState(gridId);
		// Use get() which searches by database ID (instance() searches by DOM order)
		var instances  = WP_Grid_Builder.get(gridId);
		var wpgb       = instances && instances[0];
		if (!wpgb || !wpgb.facets) return;
		state.wpgb     = wpgb;
		var breakpoint = config.breakpoint || 992;
		state.oldWidth = $(document).width();

		// Fetched: update counts in bar and popup
		wpgb.facets.on('fetched', function(t){
			var facets       = t.facets || {};
			var checkedCount = 0;
			var allCount     = 0;

			if (typeof t.count !== 'undefined') {
				allCount     = parseInt(t.count) || 0;
				checkedCount = parseInt(t.count_checked_facets) || 0;
			} else {
				allCount = parseInt(t.total) || 0;
				$.each(facets, function(id, facet){
					if (facet.type === 'selection') {
						var $h = $('<div>').html(facet.html);
						checkedCount = $h.find('.wpgb-selection-facet li').length;
					}
				});
			}

			// Always store latest count so popup shows correct value on open
			state.allCount = allCount;

			var $bar = $('.filter-mob-but-w[data-grid="' + gridId + '"]');
			if (checkedCount > 0) {
				$bar.find('button').addClass('filtered');
				$bar.find('.mob-filter-count').text(checkedCount);
				$('.reset-all').removeClass('disabled');
			} else {
				$bar.find('button').removeClass('filtered');
				$bar.find('.mob-filter-count').text('');
				$('.reset-all').addClass('disabled');
			}
			// Update popup count only if this grid is the one currently in the popup
			if (activeGridId === gridId) {
				$('#mobile-bot-filter-r .search-count').text(allCount);
			}
		});

		// Loaded: store facets
		wpgb.facets.on('loaded', function(facets){
			state.lastFacets = facets;
			// If popup is already open for this grid, refresh its contents
			if (activeGridId === gridId && state.facetsInMobile) {
				// Build new holder map keyed by facet ID
				var newHolders = {};
				for (var k in facets) {
					var fd = facets[k][0];
					if (fd && fd.id != null) newHolders[fd.id] = fd.holder;
				}
				// Update el and next references to new holders but KEEP parent refs —
				// savedFacetParents already has correct sidebar parents from the first
				// popup open (when elements were still in DOM). Resetting it here caused
				// parent=? because holders are detached at AJAX-while-popup-open time.
				state.savedFacetParents.forEach(function(item) {
					var cls = ($(item.el).attr('class') || '');
					var m = cls.match(/wpgb-facet-(\d+)/);
					if (m && newHolders[+m[1]] != null) {
						item.el = newHolders[+m[1]];
					}
					// Also update next if it pointed to another facet that was replaced
					if (item.next) {
						var nextCls = ($(item.next).attr('class') || '');
						var nm = nextCls.match(/wpgb-facet-(\d+)/);
						if (nm && newHolders[+nm[1]] != null) {
							item.next = newHolders[+nm[1]];
						}
					}
				});
				state.facetsInMobile = false;
				moveFacetsToMobile(facets, gridId);
			}
		});

		// Render: sync sort select in bar
		wpgb.facets.on('render', function(element, facet){
			if (facet.type === 'sort') {
				state.sortSlug = facet.slug;
				var $html = $(document.createElement('div')).append(facet.html);
				$('.filter-mob-but-w[data-grid="' + gridId + '"] .mob-order-select')
					.html($html.find('select').html());
			}
		});

		// Sort select change
		$(document).on('change', '.filter-mob-but-w[data-grid="' + gridId + '"] .mob-order-select', function(){
			var val = $(this).val();
			if (val) {
				wpgb.facets.autoRefresh = true;
				wpgb.facets.setParams(state.sortSlug, [val]);
				wpgb.facets.refresh();
			} else {
				wpgb.facets.reset([state.sortSlug]);
			}
		});

		// Resize: return facets to grid when going desktop
		var resizeTimer;
		$(window).on('resize.vivmbf-' + gridId, function(){
			clearTimeout(resizeTimer);
			resizeTimer = setTimeout(function(){
				var curWidth = $(document).width();
				if (state.oldWidth <= breakpoint && curWidth > breakpoint) {
					// Went to desktop — return facets, close popup if this was active grid
					returnFacetsToGrid(gridId);
					if (activeGridId === gridId) {
						$('#vivgb-mbf-popup').hide();
						$('body').removeClass('noscroll');
						activeGridId = null;
					}
				}
				state.oldWidth = curWidth;
			}, 100);
		});
	}

	// Prevent sidebar inputs from bubbling and double-firing WPGB
	$(document).on('change', '.wpgb-sidebar input', function(e){
		e.stopPropagation();
		e.preventDefault();
	});

})(jQuery);
