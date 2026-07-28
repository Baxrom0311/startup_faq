import 'dart:io';

import 'package:flutter/material.dart';
import 'package:image_picker/image_picker.dart';

import '../../../core/theme.dart';

/// Max photos per problem.
const int kMaxPhotos = 6;

/// Horizontal strip of chosen photos with an "add" tile. Owns the
/// [ImagePicker]; the parent holds the [photos] list and mutates it via
/// [onChanged].
class PhotoPickerStrip extends StatelessWidget {
  const PhotoPickerStrip({
    super.key,
    required this.photos,
    required this.onChanged,
  });

  final List<XFile> photos;
  final ValueChanged<List<XFile>> onChanged;

  Future<void> _add(BuildContext context, ImageSource source) async {
    final picker = ImagePicker();
    try {
      final remaining = kMaxPhotos - photos.length;
      if (remaining <= 0) return;

      if (source == ImageSource.camera) {
        final shot = await picker.pickImage(
          source: ImageSource.camera,
          imageQuality: 82,
          maxWidth: 2000,
        );
        if (shot != null) onChanged([...photos, shot]);
      } else {
        final picked = await picker.pickMultiImage(imageQuality: 82, maxWidth: 2000);
        if (picked.isNotEmpty) {
          onChanged([...photos, ...picked.take(remaining)]);
        }
      }
    } catch (_) {
      if (context.mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Rasm tanlab bo‘lmadi.')),
        );
      }
    }
  }

  void _remove(int index) {
    final next = [...photos]..removeAt(index);
    onChanged(next);
  }

  Future<void> _showSourceSheet(BuildContext context) async {
    final c = AppColors.of(context);
    await showModalBottomSheet<void>(
      context: context,
      backgroundColor: c.surface,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(AppTheme.radiusLg)),
      ),
      builder: (ctx) => SafeArea(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const SizedBox(height: 8),
            ListTile(
              leading: Icon(Icons.photo_camera_rounded, color: c.brand),
              title: const Text('Suratga olish'),
              onTap: () {
                Navigator.of(ctx).pop();
                _add(context, ImageSource.camera);
              },
            ),
            ListTile(
              leading: Icon(Icons.photo_library_rounded, color: c.brand),
              title: const Text('Galereyadan tanlash'),
              onTap: () {
                Navigator.of(ctx).pop();
                _add(context, ImageSource.gallery);
              },
            ),
            const SizedBox(height: 8),
          ],
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final c = AppColors.of(context);
    final canAdd = photos.length < kMaxPhotos;

    return SizedBox(
      height: 92,
      child: ListView(
        scrollDirection: Axis.horizontal,
        children: [
          for (var i = 0; i < photos.length; i++)
            Padding(
              padding: const EdgeInsets.only(right: 10),
              child: _Thumb(file: photos[i], onRemove: () => _remove(i)),
            ),
          if (canAdd)
            GestureDetector(
              onTap: () => _showSourceSheet(context),
              child: Container(
                width: 92,
                height: 92,
                decoration: BoxDecoration(
                  color: c.brand.withValues(alpha: 0.06),
                  borderRadius: BorderRadius.circular(AppTheme.radiusSm),
                  border: Border.all(color: c.brand.withValues(alpha: 0.35)),
                ),
                child: Column(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    Icon(Icons.add_a_photo_rounded, color: c.brand),
                    const SizedBox(height: 4),
                    Text('Rasm', style: TextStyle(color: c.brand, fontSize: 12)),
                  ],
                ),
              ),
            ),
        ],
      ),
    );
  }
}

class _Thumb extends StatelessWidget {
  const _Thumb({required this.file, required this.onRemove});

  final XFile file;
  final VoidCallback onRemove;

  @override
  Widget build(BuildContext context) {
    return Stack(
      clipBehavior: Clip.none,
      children: [
        ClipRRect(
          borderRadius: BorderRadius.circular(AppTheme.radiusSm),
          child: Image.file(
            File(file.path),
            width: 92,
            height: 92,
            fit: BoxFit.cover,
          ),
        ),
        Positioned(
          top: -6,
          right: -6,
          child: GestureDetector(
            onTap: onRemove,
            child: Container(
              padding: const EdgeInsets.all(3),
              decoration: const BoxDecoration(
                color: Colors.black54,
                shape: BoxShape.circle,
              ),
              child: const Icon(Icons.close_rounded, color: Colors.white, size: 16),
            ),
          ),
        ),
      ],
    );
  }
}
