import 'package:core/core.dart';
import 'package:flutter/material.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:latlong2/latlong.dart';

/// The project's map and floor plans, as they were on the old project page.

const _navyDeep = Color(0xFF0B1726);

class CatalogMap extends StatelessWidget {
  const CatalogMap({
    super.key,
    required this.lat,
    required this.lng,
    required this.label,
    required this.openLabel,
  });
  final double lat;
  final double lng;
  final String label;
  final String openLabel;

  @override
  Widget build(BuildContext context) {
    final point = LatLng(lat, lng);
    return ClipRRect(
      borderRadius: BorderRadius.circular(AppRadii.lg),
      child: SizedBox(
        height: 220,
        child: Stack(
          children: [
            FlutterMap(
              options: MapOptions(
                initialCenter: point,
                initialZoom: 15,
                interactionOptions: const InteractionOptions(
                  flags: InteractiveFlag.pinchZoom | InteractiveFlag.doubleTapZoom,
                ),
              ),
              children: [
                TileLayer(
                  urlTemplate: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
                  userAgentPackageName: 'com.devora.staff',
                  maxZoom: 19,
                ),
                MarkerLayer(
                  markers: [
                    Marker(
                      point: point,
                      width: 48,
                      height: 48,
                      child: const _MapPin(),
                    ),
                  ],
                ),
              ],
            ),
            // Open in Maps overlay button
            PositionedDirectional(
              bottom: AppSpacing.sm,
              end: AppSpacing.sm,
              child: GestureDetector(
                onTap: () => ContactActions.openMap(
                  lat: lat,
                  lng: lng,
                  label: label,
                ),
                child: Container(
                  padding: const EdgeInsets.symmetric(
                    horizontal: 12,
                    vertical: 8,
                  ),
                  decoration: BoxDecoration(
                    color: _navyDeep.withValues(alpha: 0.88),
                    borderRadius: AppRadii.pillAll,
                    border: Border.all(
                      color: Colors.white.withValues(alpha: 0.20),
                      width: 0.8,
                    ),
                  ),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      const Icon(
                        Icons.open_in_new_rounded,
                        size: 13,
                        color: Colors.white70,
                      ),
                      const SizedBox(width: 5),
                      Text(
                        openLabel,
                        style: const TextStyle(
                          fontSize: 12,
                          fontWeight: FontWeight.w700,
                          color: Colors.white,
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _MapPin extends StatelessWidget {
  const _MapPin();

  @override
  Widget build(BuildContext context) {
    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        Container(
          width: 32,
          height: 32,
          decoration: BoxDecoration(
            color: AppPalette.gold400,
            shape: BoxShape.circle,
            border: Border.all(color: Colors.white, width: 2.5),
            boxShadow: [
              BoxShadow(
                color: AppPalette.gold400.withValues(alpha: 0.5),
                blurRadius: 10,
                offset: const Offset(0, 3),
              ),
            ],
          ),
          child: const Icon(
            Icons.apartment_rounded,
            size: 16,
            color: Colors.white,
          ),
        ),
        Container(
          width: 2,
          height: 10,
          color: AppPalette.gold500,
        ),
      ],
    );
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// Floor plans gallery — horizontally swipeable full-width image viewer
// ══════════════════════════════════════════════════════════════════════════════
class CatalogFloorPlans extends StatefulWidget {
  const CatalogFloorPlans({super.key, required this.urls});
  final List<String> urls;

  @override
  State<CatalogFloorPlans> createState() => _CatalogFloorPlansState();
}

class _CatalogFloorPlansState extends State<CatalogFloorPlans> {
  final _ctrl = PageController();
  int _page = 0;

  @override
  void dispose() {
    _ctrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final colors = context.appColors;
    final multi = widget.urls.length > 1;

    return ClipRRect(
      borderRadius: BorderRadius.circular(AppRadii.lg),
      child: Container(
        height: 240,
        decoration: BoxDecoration(
          color: colors.surfaceSoft,
          border: Border.all(color: colors.hairline.withValues(alpha: 0.5)),
        ),
        child: Stack(
          children: [
            PageView.builder(
              controller: _ctrl,
              itemCount: widget.urls.length,
              onPageChanged: (i) => setState(() => _page = i),
              itemBuilder: (_, i) => AppNetworkImage(url: widget.urls[i]),
            ),
            // Page counter pill — top end
            if (multi)
              PositionedDirectional(
                top: AppSpacing.sm,
                end: AppSpacing.sm,
                child: Container(
                  padding: const EdgeInsets.symmetric(
                      horizontal: 10, vertical: 5),
                  decoration: BoxDecoration(
                    color: Colors.black.withValues(alpha: 0.50),
                    borderRadius: AppRadii.pillAll,
                  ),
                  child: Text(
                    '${_page + 1} / ${widget.urls.length}',
                    style: const TextStyle(
                        fontSize: 12,
                        fontWeight: FontWeight.w700,
                        color: Colors.white),
                  ),
                ),
              ),
            // Prev / next arrows
            if (multi) ...[
              Positioned(
                left: 6,
                top: 0,
                bottom: 0,
                child: Center(
                  child: _ArrowBtn(
                    icon: Icons.chevron_left_rounded,
                    onTap: _page > 0
                        ? () => _ctrl.previousPage(
                              duration: const Duration(milliseconds: 220),
                              curve: Curves.easeOutCubic,
                            )
                        : null,
                  ),
                ),
              ),
              Positioned(
                right: 6,
                top: 0,
                bottom: 0,
                child: Center(
                  child: _ArrowBtn(
                    icon: Icons.chevron_right_rounded,
                    onTap: _page < widget.urls.length - 1
                        ? () => _ctrl.nextPage(
                              duration: const Duration(milliseconds: 220),
                              curve: Curves.easeOutCubic,
                            )
                        : null,
                  ),
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }
}

class _ArrowBtn extends StatelessWidget {
  const _ArrowBtn({required this.icon, required this.onTap});
  final IconData icon;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final enabled = onTap != null;
    return GestureDetector(
      onTap: onTap,
      child: Container(
        width: 32,
        height: 32,
        decoration: BoxDecoration(
          color: Colors.black.withValues(alpha: enabled ? 0.45 : 0.20),
          shape: BoxShape.circle,
        ),
        child: Icon(icon,
            size: 20,
            color: Colors.white.withValues(alpha: enabled ? 1.0 : 0.35)),
      ),
    );
  }
}
