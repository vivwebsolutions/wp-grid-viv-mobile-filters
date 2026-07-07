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
				facetSidebarOrder: {}, // { facetId: index } saved on first popup open
				facetsInMobile:    false,
				sortSlug:          '',
				oldWidth:          $(document).width()
			};
		}
		return gridStates[id];
	}

	// Stamp data-grid onto class-based bars inside a grid wrapper that omit it,
	// so a custom-HTML "Filter" button (rendered after init) resolves to its grid.
	function stampBars(gridId) {
		$('.wpgb-grid-' + gridId + ' .filter-mob-but-w:not([data-grid])').attr('data-grid', gridId);
	}

	// ---- Open popup ----------------------------------------------------------
	$(document).on('click', '.filter-mob-but-w > button, .vivgb-show-mob-filters', function(){
		var $bar   = $(this).closest('.filter-mob-but-w');
		var gridId = parseInt($bar.data('grid') || $(this).data('grid'), 10);
		// Fall back to the enclosing grid wrapper when the bar has no data-grid yet
		// (custom-HTML button that rendered/was clicked before it was stamped).
		if (!gridId) {
			var m = ($bar.closest('[class*="wpgb-grid-"]').attr('class') || '').match(/wpgb-grid-(\d+)/);
			gridId = m ? parseInt(m[1], 10) : 0;
		}

		if (!gridId) return;

		// Return previous grid's facets before loading new ones
		if (activeGridId && activeGridId !== gridId) {
			returnFacetsToGrid(activeGridId);
		}
		activeGridId = gridId;
		$('#vivgb-mbf-scroll').addClass('vivgb-mbf-loading');
		moveFacetsToMobile(getState(gridId).lastFacets, gridId);
		// Let parent-plugin place children back into placeholders after DOM settles.
		setTimeout(function() {
			window.vivgb_parent_setup_all && window.vivgb_parent_setup_all();
			$('#vivgb-mbf-scroll').removeClass('vivgb-mbf-loading');
		}, 0);
		// Show stored result count immediately (fetched may have fired before popup was opened)
		var _st = getState(gridId);
		if (_st.allCount !== undefined) {
			$('#mobile-bot-filter-r .search-count').text(_st.allCount);
		}
		$('#vivgb-mbf-popup').css('display', 'flex').hide().fadeIn(300);
		$('body').addClass('vivgb-noscroll');
	});

	// ---- Close popup ---------------------------------------------------------

	$(document).on('click', '#mob-filter-close, #mob-show-res', function(){
		$('#vivgb-mbf-popup').fadeOut();
		$('body').removeClass('vivgb-noscroll');
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
		var saveParents = state.savedFacetParents.length === 0;

		// Collect child IDs of viv_parent facets — children travel inside parent placeholder.
		var parentChildIds = {};
		for (var pk in facets) {
			var pf = facets[pk][0];
			if (!pf || pf.type !== 'viv_parent') continue;
			if (!pf.settings || !Array.isArray(pf.settings.childs)) continue;
			pf.settings.childs.forEach(function(cid) {
				parentChildIds[parseInt(cid, 10)] = true;
			});
		}

		$('#vivgb-mbf-scroll').empty();
		$('#mbf-selection').empty();

		var toPlace = [];
		for (var key in facets) {
			var f = facets[key][0];
			if (skipAll.indexOf(f.type) !== -1) continue;
			// Children live inside the parent placeholder — skip them as standalone items.
			// They are NOT saved to savedFacetParents; they travel with the parent element.
			if (parentChildIds[f.id]) continue;
			if (saveParents) {
				state.savedFacetParents.push({el: f.holder, parent: $(f.holder).parent(), next: f.holder.nextSibling});
			}
			if (f.type === 'selection') {
				$('#mbf-selection').append(f.holder);
			} else {
				toPlace.push(f);
			}
		}

		toPlace.sort(function(a, b) {
			if (typeof a.order === 'number' && typeof b.order === 'number') return a.order - b.order;
			if (typeof a.order === 'number') return -1;
			if (typeof b.order === 'number') return 1;
			// First open: holders are in DOM — sort by real sidebar DOM position and save the order.
			if (a.holder.isConnected && b.holder.isConnected) {
				var cmp = a.holder.compareDocumentPosition(b.holder);
				return (cmp & Node.DOCUMENT_POSITION_FOLLOWING) ? -1 : 1;
			}
			// Subsequent opens (holders detached after AJAX) — use saved sidebar order.
			var oa = state.facetSidebarOrder[a.id];
			var ob = state.facetSidebarOrder[b.id];
			if (oa != null && ob != null) return oa - ob;
			if (oa != null) return -1;
			if (ob != null) return 1;
			return 0;
		});

		// Save sidebar order on first open for use in subsequent AJAX refreshes.
		if (saveParents) {
			toPlace.forEach(function(f, i) { state.facetSidebarOrder[f.id] = i; });
		}
		
		toPlace.forEach(function(f) {
			$('#vivgb-mbf-scroll').append(f.holder);
		});

		$(document).trigger('vivgb.mbf.facetsMoved', [gridId, toPlace]);
		// Sort savedFacetParents by original DOM order (needed for correct restoration).
		if (saveParents && state.savedFacetParents.length > 1) {
			state.savedFacetParents.sort(function(a, b) {
				var pos = a.el.compareDocumentPosition(b.el);
				return (pos & Node.DOCUMENT_POSITION_FOLLOWING) ? -1 : 1;
			});
		}
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
		$(document).trigger('vivgb.mbf.facetsReturned', [gridId, state.savedFacetParents]);
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

		// Best-effort stamp at init; re-run on every fetch below to catch bars that
		// render later (e.g. a custom-HTML button injected after wpgb.loaded).
		stampBars(gridId);

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
				var skipTypes = ['load_more', 'result_count', 'reset', 'sort', 'viv_view_toggle', 'pagination', 'selection', 'viv_parent'];
				$.each(facets, function(id, facet){
					if (skipTypes.indexOf(facet.type) === -1 && Array.isArray(facet.selected)) {
						checkedCount += facet.selected.length;
					}
				});
			}

			// Always store latest count so popup shows correct value on open
			state.allCount = allCount;

			// Defer bar update so DOM is ready (fetched may fire during WPGB init)
			setTimeout(function() {
				stampBars(gridId);
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
			}, 0);
		});

		// Loading: hide scroll to prevent visible re-flatten jerk.
		wpgb.facets.on('loading', function(){
			if (activeGridId === gridId) {
				$('#vivgb-mbf-scroll').addClass('vivgb-mbf-loading');
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
			setTimeout(function() {
				window.vivgb_parent_setup_all && window.vivgb_parent_setup_all();
				$('#vivgb-mbf-scroll').removeClass('vivgb-mbf-loading');
			}, 0);
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
					setTimeout(function() {
						window.vivgb_parent_setup_all && window.vivgb_parent_setup_all();
					}, 0);
					if (activeGridId === gridId) {
						$('#vivgb-mbf-popup').hide();
						$('body').removeClass('vivgb-noscroll');
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
