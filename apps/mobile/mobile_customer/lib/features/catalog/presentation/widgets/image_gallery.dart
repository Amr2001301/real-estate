import 'package:core/core.dart';
import 'package:flutter/material.dart';

/// A swipeable image gallery with page-dot indicators. Falls back to the
/// brand-gradient placeholder when there are no images.
class ImageGallery extends StatefulWidget {
  const ImageGallery({super.key, required this.images});

  final List<String> images;

  @override
  State<ImageGallery> createState() => _ImageGalleryState();
}

class _ImageGalleryState extends State<ImageGallery> {
  final _controller = PageController();
  int _index = 0;

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final colors = context.appColors;
    final images = widget.images.isEmpty ? [null] : widget.images;

    return Stack(
      fit: StackFit.expand,
      children: [
        PageView.builder(
          controller: _controller,
          itemCount: images.length,
          onPageChanged: (i) => setState(() => _index = i),
          itemBuilder: (_, i) => AppNetworkImage(url: images[i]),
        ),
        if (images.length > 1)
          PositionedDirectional(
            bottom: AppSpacing.md,
            start: 0,
            end: 0,
            child: Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                for (var i = 0; i < images.length; i++)
                  AnimatedContainer(
                    duration: const Duration(milliseconds: 250),
                    margin: const EdgeInsets.symmetric(horizontal: 3),
                    width: i == _index ? 18 : 6,
                    height: 6,
                    decoration: BoxDecoration(
                      color: i == _index
                          ? colors.brandGold
                          : Colors.white.withValues(alpha: 0.7),
                      borderRadius: AppRadii.pillAll,
                    ),
                  ),
              ],
            ),
          ),
      ],
    );
  }
}
