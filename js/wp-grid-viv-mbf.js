(function($){
	// Defaults — may be overridden by viv-addon or inline script from this plugin
	if(typeof viv_first_load === 'undefined') var viv_first_load = true;
	if(typeof vivgb_grid_id === 'undefined')  var vivgb_grid_id  = 1;

	var wpgb;
	var old_width = $(document).width();

	$('#filter-mob-but-w button').on('click', function(){
		$('#vivgb-mbf-popup').fadeIn();
		$('body').addClass('noscroll');
	});

	$(document).on('click', '#mob-filter-close, #mob-show-res', function(){
		$('#vivgb-mbf-popup').fadeOut();
		$('body').removeClass('noscroll');
	});

	window.addEventListener('wpgb.loaded', function(){ (function(){
		wpgb = WP_Grid_Builder.instance(vivgb_grid_id);
		if(!wpgb || !wpgb.init){ return; }

		wpgb.facets.on('fetched', function(t){
			var all_count = parseInt(t.count);
			$('#mobile-bot-filter-r .search-count').text(all_count);
			if(t.count_checked_facets > 0){
				$('#filter-mob-but-w button').addClass('filtered');
				$('#filter-mob-but-w button span').text(t.count_checked_facets);
				$('.reset-all').removeClass('disabled');
			} else {
				$('#filter-mob-but-w button').removeClass('filtered');
				$('.reset-all').addClass('disabled');
			}
		});

		wpgb.facets.on('loaded', function(facets){
			if($(document).width() > viv_mbf_breakpoint) return;
			var skip = ['load_more','result_count','reset','sort','viv_view_toggle'];
			if(typeof window.viv_mbf_skip_facets !== 'undefined' && Array.isArray(window.viv_mbf_skip_facets)){
				skip = skip.concat(window.viv_mbf_skip_facets);
			}
			if(viv_first_load){
				var facets_arr = [];
				for(var key in facets){
					var f = facets[key][0];
					if(skip.includes(f.type)) continue;
					if(f.type === 'selection'){
						$('#mbf-selection').append(f.holder);
					} else {
						facets_arr[f.order] = f.holder;
					}
				}
				$('#vivgb-mbf-sroll').append(facets_arr);
				viv_first_load = false;
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

		$(window).on('resize', function(){
			var cur_width = $(document).width();
			if(old_width > viv_mbf_breakpoint && cur_width <= viv_mbf_breakpoint){
				wpgb.facets.init();
				old_width = cur_width;
			}
			if(old_width <= viv_mbf_breakpoint && cur_width > viv_mbf_breakpoint){
				$('.wp-grid-builder').addClass('wpgb-loading');
				location.reload();
			}
		});

	})(); });

	// Prevent sidebar inputs from bubbling and double-firing WPGB
	$(document).on('change', '.wpgb-sidebar input', function(e){
		e.stopPropagation();
		e.preventDefault();
	});

})(jQuery);
