import sys
from pathlib import Path

# Makes `import app...` and `import tests...` work no matter what directory
# pytest is invoked from.
sys.path.insert(0, str(Path(__file__).resolve().parent))
