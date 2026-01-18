#!/usr/bin/env python
# Point d'entrée pour PyInstaller qui lance Daphne
import sys
import os
from daphne.cli import CommandLineInterface

if __name__ == '__main__':
    # Définir le module ASGI
    sys.argv = [
        'daphne',
        '--bind', '0.0.0.0',
        '--port', '8000',
        'born_dz.asgi:application'
    ]
    
    # Lancer Daphne
    CommandLineInterface().run(sys.argv[1:])
