(function($){
	// Defaults — may be overridden by inline script from PHP
	if(typeof viv_first_load === 'undefined') var viv_first_load = true;
	if(typeof vivgb_grid_id === 'undefined')  var vivgb_grid_id  = 1;

	var wpgb;
	var sort = false;
	var saved_facet_parents = [];
	var last_facets = null;
	var facets_in_mobile = false;
	var old_width = $(document).width();

	$(document).on('click', '#filter-mob-but-w button, .vivgb-show-mob-filters', function(){
		moveFacetsToMobile(last_facets);
		$('#vivgb-mbf-popup').css('display', 'flex').hide().fadeIn(300);
		$('body').addClass('noscroll');
	});

	$(document).on('click', '#mob-filter-close, #mob-show-res', function(){
		$('#vivgb-mbf-popup').fadeOut();
		$('body').removeClass('noscroll');
		wpgb = WP_Grid_Builder.instance(vivgb_grid_id);
		if(!wpgb || !wpgb.facets){ return; }
		wpgb.grid.layout();
	});

	function moveFacetsToMobile(facets) {
		if(facets_in_mobile) return;
		var skip = ['load_more', 'result_count', 'reset', 'sort', 'viv_view_toggle', 'pagination'];
		if(typeof window.viv_mbf_skip_facets !== 'undefined' && Array.isArray(window.viv_mbf_skip_facets)){
			skip = skip.concat(window.viv_mbf_skip_facets);
		}
		var facets_arr = [];
		var save_parents = saved_facet_parents.length === 0;
		$('#vivgb-mbf-sroll').empty();
		$('#mbf-selection').empty();
		for(var key in facets){
			var f = facets[key][0];
			if(skip.includes(f.type)) continue;
			if(save_parents) saved_facet_parents.push({el: f.holder, parent: $(f.holder).parent()});
			if(f.type === 'selection'){
				$('#mbf-selection').append(f.holder);
			} else {
				if(f.order !== undefined && f.order !== null){
					facets_arr[f.order] = f.holder;
				} else {
					facets_arr.push(f.holder);
				}
			}
		}
		$('#vivgb-mbf-sroll').append(facets_arr);
		facets_in_mobile = true;
	}

	window.viv_num_of_checked = false;

	window.addEventListener('wpgb.loaded', function(){ (function(){
		wpgb = WP_Grid_Builder.instance(vivgb_grid_id);
		if(!wpgb || !wpgb.facets){ return; }

		wpgb.facets.on('fetched', function(t){
			var facets = t.facets || {};
			var checked_count = 0;
			var all_count = 0;

			if(typeof t.count !== 'undefined'){
				// Addon-style: flat properties
				all_count     = parseInt(t.count) || 0;
				checked_count = parseInt(t.count_checked_facets) || 0;
			} else {
				// Native-style: t.total always present (render + refresh)
				all_count = parseInt(t.total) || 0;
				$.each(facets, function(id, facet){
					if(facet.type === 'selection'){
						var $h = $('<div>').html(facet.html);
						checked_count = $h.find('.wpgb-selection-facet li').length;
					}
				});
			}

			window.viv_num_of_checked = checked_count;
			$('#mobile-bot-filter-r .search-count').text(all_count);
			if(checked_count > 0){
				$('#filter-mob-but-w button').addClass('filtered');
				$('#filter-mob-but-w button span').text(checked_count);
				$('.reset-all').removeClass('disabled');
			} else {
				$('#filter-mob-but-w button').removeClass('filtered');
				$('.reset-all').addClass('disabled');
			}
		});

		wpgb.facets.on('loaded', function(facets){
			last_facets = facets;
			if($(document).width() > viv_mbf_breakpoint) return;
			if(viv_first_load){
				moveFacetsToMobile(facets);
			}
		});

		var search_facet_slug = '';
		wpgb.facets.on('render', function(element, facet){
			if(facet.type === 'sort'){
				var htmlObject = document.createElement('div');
				$(htmlObject).append(facet.html);
				$('#mob-order-select').html($(htmlObject).find('select').html());
				search_facet_slug = facet.slug;
			}
		});

		$(document).on('change', '#mob-order-select', function(){
			var val = $(this).val();
			if(val){
				wpgb.facets.autoRefresh = true;
				wpgb.facets.setParams(search_facet_slug, [val]);
				wpgb.facets.refresh();
			} else {
				wpgb.facets.reset([search_facet_slug]);
			}
		});

		$('.reset-all').on('click', function(){
			if($(this).hasClass('disabled')) return;
			wpgb.facets.reset();
		});

		old_width = $(document).width();
		$(window).on('resize', function(){
			var cur_width = $(document).width();
			if(old_width > viv_mbf_breakpoint){
				if(cur_width <= viv_mbf_breakpoint){
					if(last_facets) moveFacetsToMobile(last_facets);
					old_width = $(document).width();
				}
			}
			if(old_width <= viv_mbf_breakpoint){
				if(cur_width > viv_mbf_breakpoint){
					saved_facet_parents.forEach(function(item){
						item.parent.append(item.el);
					});
					facets_in_mobile = false;
					old_width = $(document).width();
				}
			}
		});

	})(); });

	// Prevent sidebar inputs from bubbling and double-firing WPGB
	$(document).on('change', '.wpgb-sidebar input', function(e){
		e.stopPropagation();
		e.preventDefault();
	});

})(jQuery);
