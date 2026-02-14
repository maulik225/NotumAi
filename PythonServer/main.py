import uvicorn
import os
import sys

# Add the current directory to sys.path so we can import 'app'
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

# Import the application instance
from app.main import app

if __name__ == "__main__":
    # Start the server
    uvicorn.run("app.main:app", host="127.0.0.1", port=8009, reload=False)