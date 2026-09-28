#!/usr/bin/env python3
"""Measure face landmarks locally, without identifying or searching for a person.

Use a temporary Python environment with mediapipe, numpy, and Pillow.
The model is the official MediaPipe FaceLandmarker task. Its inferred depth
and facial transform are estimates, not a measured 3D scan.
"""
import argparse
import hashlib
import json
from pathlib import Path

import mediapipe as mp
import numpy as np
from mediapipe.tasks.python import vision
from PIL import Image, ImageDraw

FEATURES = {
    1: 'nose tip', 4: 'nose bridge lower', 6: 'nose bridge upper',
    33: 'right outer eye', 133: 'right inner eye',
    362: 'left inner eye', 263: 'left outer eye',
    468: 'right iris', 473: 'left iris',
    98: 'right nose base', 327: 'left nose base',
    61: 'right mouth corner', 291: 'left mouth corner',
    0: 'upper lip border', 17: 'lower lip border', 13: 'upper lip inner', 14: 'lower lip inner',
    152: 'chin', 10: 'upper forehead', 234: 'right cheek', 454: 'left cheek',
    172: 'right lower jaw', 397: 'left lower jaw', 127: 'right temple', 356: 'left temple',
}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--model', type=Path, required=True)
    parser.add_argument('--image', type=Path, required=True)
    parser.add_argument('--output', type=Path, required=True)
    parser.add_argument('--crop', nargs=4, type=int, metavar=('LEFT', 'TOP', 'RIGHT', 'BOTTOM'))
    parser.add_argument('--view', type=int, choices=(0, 1, 2))
    parser.add_argument('--delegate', choices=('cpu', 'gpu'), default='gpu',
                        help='Local accelerator. MediaPipe 1.0.1 on macOS requires GPU graph services.')
    args = parser.parse_args()
    photo = Image.open(args.image).convert('RGB')
    original_size = photo.size
    if args.crop:
        photo = photo.crop(args.crop)
    options = vision.FaceLandmarkerOptions(
        base_options=mp.tasks.BaseOptions(model_asset_path=str(args.model), delegate=getattr(mp.tasks.BaseOptions.Delegate, args.delegate.upper())),
        running_mode=vision.RunningMode.IMAGE, num_faces=1,
        output_face_blendshapes=True, output_facial_transformation_matrixes=True,
    )
    with vision.FaceLandmarker.create_from_options(options) as detector:
        # The macOS Metal bridge requires a four-channel pixel buffer.
        result = detector.detect(mp.Image(image_format=mp.ImageFormat.SRGBA, data=np.asarray(photo.convert('RGBA'))))
    if len(result.face_landmarks) != 1:
        raise RuntimeError('Expected one visible face. Check the image crop and exposure.')
    width, height = photo.size
    points = [dict(id=i, x=p.x*width, y=p.y*height, estimated_z=p.z*width,
                   **({'feature': FEATURES[i]} if i in FEATURES else {}))
              for i, p in enumerate(result.face_landmarks[0])]
    report = {
        'source': str(args.image), 'source_dimensions': original_size, 'crop': args.crop,
        'width': width, 'height': height, 'view': args.view,
        'method': f'MediaPipe {mp.__version__} FaceLandmarker {args.delegate.upper()} IMAGE',
        'model_sha256': hashlib.sha256(args.model.read_bytes()).hexdigest(),
        'caveat': 'Landmark estimates require visual checking. Inferred depth is not measured depth. Do not use iris centers as fixed geometry when gaze differs.',
        'points': points,
        'estimated_transform': result.facial_transformation_matrixes[0].tolist(),
        'expression': {c.category_name: c.score for c in result.face_blendshapes[0]},
    }
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(report, indent=2)+'\n')
    overlay = photo.copy()
    draw = ImageDraw.Draw(overlay)
    for point in points:
        x, y, index = point['x'], point['y'], point['id']
        if index in FEATURES:
            draw.ellipse((x-3, y-3, x+3, y+3), fill='#00efff')
            draw.text((x+4, y-12), str(index), fill='#00efff', stroke_width=1, stroke_fill='#182125')
        else:
            draw.ellipse((x-1, y-1, x+1, y+1), fill='#35bc59')
    annotated = args.output.with_suffix('.png')
    overlay.save(annotated)
    print(json.dumps({'output': str(args.output), 'overlay': str(annotated), 'landmarks': len(points)}))


if __name__ == '__main__':
    main()
