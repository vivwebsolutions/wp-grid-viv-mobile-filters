<?php
/**
 * Mobile filter button bar — rendered just before the grid wrapper.
 * $settings is available via the global $viv_mbf_active_settings.
 */
global $wpdb, $viv_mbf_active_settings;
$settings = $viv_mbf_active_settings;

$facet_types = [];
if ( ! empty( $settings->grid_layout ) ) {
    $facet_ids = [];
    foreach ( (array) $settings->grid_layout as $area ) {
        $area = (array) $area;
        if ( ! empty( $area['facets'] ) ) {
            $facet_ids = array_merge( $facet_ids, (array) $area['facets'] );
        }
    }
    if ( $facet_ids ) {
        $ids_placeholder = implode( ',', array_map( 'intval', $facet_ids ) );
        $facet_types = $wpdb->get_col(
            "SELECT type FROM {$wpdb->prefix}wpgb_facets WHERE id IN ({$ids_placeholder})"
        );
    }
}
?>
<div id="filter-mob-but-w">
    <button>Filter <img decoding="async" src="<?php echo esc_url( WPGB_VMF_URL . 'img/sk.svg' ); ?>"><span id="mob-filter-count"></span></button>

    <?php if ( in_array( 'sort', $facet_types, true ) ) : ?>
    <span class="mob-order">Sort <img decoding="async" src="<?php echo esc_url( WPGB_VMF_URL . 'img/sort.svg' ); ?>">
        <select name="order_by" class="order_by" id="mob-order-select"></select>
    </span>
    <?php endif; ?>

    <?php if ( in_array( 'reset', $facet_types, true ) ) : ?>
    <span class="reset-all">Reset All</span>
    <?php endif; ?>
</div>
