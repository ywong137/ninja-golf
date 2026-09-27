"""Compatibility entry point for the licensed native-human character build.

Run Blender with --background --python tools/build-warriors.py.
Append -- --enemies to build the four enemy models.
"""
import pathlib,runpy
runpy.run_path(str(pathlib.Path(__file__).with_name('build-rocketbox-warriors.py')),run_name='__main__')
