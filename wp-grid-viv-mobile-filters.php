<?php
/**
 * Plugin Name: WP Grid Builder Viv Mobile Filters
 * Description: Adds a mobile-friendly filter drawer to WP Grid Builder grids. Enable per-grid in the Viv Settings panel.
 * Version:	 1.0.0
 * Author:	  ViV Web Solutions
 * Author URI:  https://vivwebsolutions.com/
 * Requires at least: 5.2
 * Requires PHP: 7.2
 * Requires Plugins: wp-grid-builder
 */

if ( ! defined( 'ABSPATH' ) ) exit;

define( 'WPGB_VMF_VERSION', '1.0.0' );
define( 'WPGB_VMF_URL',	 plugin_dir_url( __FILE__ ) );
define( 'WPGB_VMF_PATH',	plugin_dir_path( __FILE__ ) );

function wpgb_vmf_get_part_path( $filename ) {
	// Try child theme first
	if ( defined('WP_CONTENT_DIR') ) {
		$child = WP_CONTENT_DIR . '/themes/' . get_stylesheet() . '/vigb/parts/' . $filename;
		if ( file_exists( $child ) ) return $child;
		$parent = WP_CONTENT_DIR . '/themes/' . get_template() . '/vigb/parts/' . $filename;
		if ( file_exists( $parent ) ) return $parent;
	} else {
		// Fallback: try to guess theme path relative to plugin
		$base = dirname( dirname( dirname( __FILE__ ) ) ) . '/themes/';
		$themes = @scandir($base);
		if ( is_array($themes) ) {
			foreach ($themes as $theme) {
				if ($theme === '.' || $theme === '..') continue;
				$candidate = $base . $theme . '/vigb/parts/' . $filename;
				if ( file_exists($candidate) ) return $candidate;
			}
		}
	}
	return WPGB_VMF_PATH . 'parts/' . $filename;
}

// ---------------------------------------------------------------------------
// Inject total into render_response (first load) — same as refresh_response
// so that t.total is always available in JS, not only after filtering
// ---------------------------------------------------------------------------
add_filter( 'wp_grid_builder/async/render_response', function( $response ) {
    if ( function_exists( 'wpgb_get_found_objects' ) ) {
        $response['total'] = wpgb_get_found_objects();
    }
    return $response;
} );

// ---------------------------------------------------------------------------
// Admin: register the "Viv" tab for grids if viv-addon is not active
// ---------------------------------------------------------------------------
add_filter( 'wp_grid_builder/tabs/grid', function( $tabs ) {
	foreach ( $tabs as $tab ) {
		if ( ( $tab['name'] ?? '' ) === 'viv' ) return $tabs;
	}
	$tabs[] = [ 'name' => 'viv', 'title' => __( 'ViV', 'wpgb-viv-mobile-filters' ) ];
	return $tabs;
} );

// ---------------------------------------------------------------------------
// Admin: add Mobile Filters settings to the WPGB grid "Viv" panel
// ---------------------------------------------------------------------------
add_filter( 'wp_grid_builder/controls/grid', function( $controls ) {

	$mobile_fields = [
		'en_viv_mobile_filters' => [
			'type'  => 'toggle',
			'label' => __( 'Enable Viv Mobile Filters', 'wpgb-viv-mobile-filters' ),
		],
		'viv_mob_breakpoint' => [
			'type'  => 'number',
			'label' => __( 'Mobile Breakpoint (px)', 'wpgb-viv-mobile-filters' ),
			'condition' => [
				[
					'field'   => 'en_viv_mobile_filters',
					'compare' => '==',
					'value'   => 1,
				],
			],
		],
        'viv_show_mbf_order' => [
			'type'  => 'toggle',
			'label' => __( 'Show Order Button', 'wpgb-viv-mobile-filters' ),
            'info'=> __( 'Requires a "sort" facet to be added to the grid layout', 'wpgb-viv-mobile-filters' ),
			'condition' => [
				[
					'field'   => 'en_viv_mobile_filters',
					'compare' => '==',
					'value'   => 1,
				],
			],
		],
        'viv_mob_mbf_reset' => [
			'type'  => 'toggle',
			'label' => __( 'Show Reset Button', 'wpgb-viv-mobile-filters' ),
			'condition' => [
				[
					'field'   => 'en_viv_mobile_filters',
					'compare' => '==',
					'value'   => 1,
				],
			],
		],
	];

	// Merge into the existing "viv" fieldset if viv-addon is active, else create our own
	if ( isset( $controls['viv']['fields'] ) ) {
		$controls['viv']['fields'] = array_merge( $controls['viv']['fields'], $mobile_fields );
	} else {
		$controls['viv_mobile'] = [
			'type'   => 'fieldset',
			'panel'  => 'viv',
			'legend' => __( 'Viv Mobile Filters', 'wpgb-viv-mobile-filters' ),
			'fields' => $mobile_fields,
		];
	}

	return $controls;
} );

// ---------------------------------------------------------------------------
// Front-end: inject filter button bar + footer popup when enabled on the grid
// Skip if wp-grid-viv-addon is active — it already handles this itself
// ---------------------------------------------------------------------------
add_filter( 'wp_grid_builder/layout/wrapper_tag', function( $div, $settings ) {
	// Inject the Filter button bar directly before the grid wrapper
	if ( empty( $settings->en_viv_mobile_filters ) || ! $settings->en_viv_mobile_filters ) {
		return $div;
	}
	static $grids_bar_rendered = [];
	static $popup_rendered     = false;

	$viv_mbf_grid_id = (int) ( $settings->id ?? 0 );
	if ( ! $viv_mbf_grid_id || isset( $grids_bar_rendered[ $viv_mbf_grid_id ] ) ) {
		return $div;
	}
	$grids_bar_rendered[ $viv_mbf_grid_id ] = true;

	include wpgb_vmf_get_part_path( 'mobile-filters.php' );

	if ( ! $popup_rendered ) {
		$popup_rendered = true;
		add_action( 'wp_footer', function () {
			include wpgb_vmf_get_part_path( 'mobile-filters-popup.php' );
		}, 99 );
	}

	return $div;
}, 10, 2 );

// ---------------------------------------------------------------------------
// Enqueue scripts and styles
// ---------------------------------------------------------------------------
function vivmbf_enqueue_scripts($gs, $grid_id) {
	$breakpoint = ! empty( $gs->viv_mob_breakpoint ) ? (int) $gs->viv_mob_breakpoint : 992;

	wp_enqueue_style(
		'wpgb-viv-mbf',
		WPGB_VMF_URL . 'css/wp-grid-viv-mbf.css',
		[],
		WPGB_VMF_VERSION
	);

	// Hide sidebar / top filter areas on mobile for THIS grid only (scoped by .wpgb-grid-{id})
	$sel = '.wpgb-grid-' . $grid_id;
	$inline_css = '@media(max-width:' . $breakpoint . 'px){' .
		'.filter-mob-but-w[data-grid="' . $grid_id . '"]{display:block;padding-left:0;}' .
		$sel . ' .wpgb-area.wpgb-area-top-2,' .
		$sel . ' .wpgb-area.wpgb-area-top-1,' .
		$sel . ' .wpgb-sidebar{display:none;}' .
		$sel . ' .wpgb-main .wpgb-layout{padding-left:0;max-width:100%;flex:0 0 100%;}' .
	'}';
	wp_add_inline_style( 'wpgb-viv-mbf', $inline_css );

	wp_enqueue_script(
		'wpgb-viv-mbf',
		WPGB_VMF_URL . 'js/wp-grid-viv-mbf.js',
		[ 'jquery' ],
		WPGB_VMF_VERSION,
		true
	);
	// Accumulate per-grid config into a shared object (safe for multiple calls)
	wp_add_inline_script(
		'wpgb-viv-mbf',
		'window.vivgb_mbf_grids=window.vivgb_mbf_grids||{};' .
		'vivgb_mbf_grids[' . $grid_id . ']={breakpoint:' . $breakpoint . '};',
		'before'
	);
}

add_filter( 'wp_grid_builder/grid/settings',function($settings){
	if(!empty($settings['en_viv_mobile_filters']) && $settings['en_viv_mobile_filters']){
		
		// Enqueue scripts when the grid is rendered
		static $enqueued_grids = [];
		$grid_id = isset($settings['id']) ? $settings['id'] : 0;
		
		if($grid_id && !isset($enqueued_grids[$grid_id])){
			vivmbf_enqueue_scripts((object)$settings, $grid_id);
			$enqueued_grids[$grid_id] = true;
		}
	}

	return $settings;
});
