import os, sys
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "born_dz.settings")
if hasattr(sys, "_MEIPASS"):
    sys.path.insert(0, sys._MEIPASS)
