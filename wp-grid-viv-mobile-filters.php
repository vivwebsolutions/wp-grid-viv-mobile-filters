<?php
/**
 * Plugin Name: WP Grid Builder Viv Mobile Filters
 * Description: Adds a mobile-friendly filter drawer to WP Grid Builder grids. Enable per-grid in the Viv Settings panel.
 * Version:     1.0.0
 * Author:      ViV Web Solutions
 * Author URI:  https://vivwebsolutions.com/
 * Requires at least: 5.2
 * Requires PHP: 7.2
 * Requires Plugins: wp-grid-builder
 */

if ( ! defined( 'ABSPATH' ) ) exit;

define( 'WPGB_VMF_VERSION', '1.0.0' );
define( 'WPGB_VMF_URL',     plugin_dir_url( __FILE__ ) );
define( 'WPGB_VMF_PATH',    plugin_dir_path( __FILE__ ) );

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
    if ( defined( 'WPGB_VIV_URL' ) ) return $div; // viv-addon handles it
    global $viv_mbf_active_settings, $viv_mbf_footer_registered;

    if ( empty( $settings->en_viv_mobile_filters ) || ! $settings->en_viv_mobile_filters ) {
        return $div;
    }

    $viv_mbf_active_settings = $settings;

    // Inject the Filter button bar directly before the grid wrapper
    include WPGB_VMF_PATH . 'parts/mobile-filters.php';

    // Register the popup in the footer once per page
    if ( empty( $viv_mbf_footer_registered ) ) {
        $viv_mbf_footer_registered = true;
        add_action( 'wp_footer', function() {
            include WPGB_VMF_PATH . 'parts/mobile-filters-popup.php';
        }, 99 );
    }

    return $div;
}, 10, 2 );

// ---------------------------------------------------------------------------
// Enqueue scripts and styles
// ---------------------------------------------------------------------------
add_action( 'wp_enqueue_scripts', function() {
    global $post, $wpdb;

    // viv-addon enqueues its own copy when active — avoid duplicate assets
    if ( defined( 'WPGB_VIV_URL' ) ) return;

    if ( empty( $post->post_content ) || strpos( $post->post_content, '[wpgb_grid' ) === false ) {
        return;
    }

    // Extract grid ID from shortcode
    preg_match( '#\[wpgb_grid[^\]]*\sid="(\d+)"#', $post->post_content, $matches );
    $grid_id = ! empty( $matches[1] ) ? (int) $matches[1] : 0;
    if ( ! $grid_id ) return;

    $raw = $wpdb->get_var( $wpdb->prepare(
        "SELECT settings FROM {$wpdb->prefix}wpgb_grids WHERE id = %d", $grid_id
    ) );
    if ( ! $raw ) return;

    $gs = json_decode( $raw );
    if ( empty( $gs->en_viv_mobile_filters ) || ! $gs->en_viv_mobile_filters ) {
        return;
    }

    $breakpoint = ! empty( $gs->viv_mob_breakpoint ) ? (int) $gs->viv_mob_breakpoint : 992;

    wp_enqueue_style(
        'wpgb-viv-mbf',
        WPGB_VMF_URL . 'css/wp-grid-viv-mbf.css',
        [],
        WPGB_VMF_VERSION
    );

    // Hide sidebar / top filter areas on mobile; show the Filter button bar
    $inline_css = '@media(max-width:' . $breakpoint . 'px){' .
        '#filter-mob-but-w{display:block;padding-left:0;}' .
        '.wp-grid-builder .wpgb-area.wpgb-area-top-2,' .
        '.wp-grid-builder .wpgb-area.wpgb-area-top-1,' .
        '.wp-grid-builder .wpgb-sidebar{display:none;}' .
        'div.wp-grid-builder .wpgb-main .wpgb-layout{padding-left:0;max-width:100%;flex:0 0 100%;}' .
    '}';
    wp_add_inline_style( 'wpgb-viv-mbf', $inline_css );

    wp_enqueue_script(
        'wpgb-viv-mbf',
        WPGB_VMF_URL . 'js/wp-grid-viv-mbf.js',
        [ 'jquery' ],
        WPGB_VMF_VERSION,
        true
    );
    wp_add_inline_script(
        'wpgb-viv-mbf',
        'var viv_mbf_breakpoint=' . $breakpoint . ';' .
        'var vivgb_grid_id=' . $grid_id . ';' .
        'var viv_first_load=true;',
        'before'
    );
} );
