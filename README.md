# Olives - Idle Game

A simple idle game where you collect olives!

## Setup

1. Create a virtual environment:
   ```bash
   python3 -m venv venv
   ```

2. Activate the virtual environment:
   - macOS/Linux: `source venv/bin/activate`
   - Windows: `venv\Scripts\activate`

3. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```

4. Run the application:
   ```bash
   python app.py
   ```

5. Open your browser and navigate to `http://localhost:5000`

## Game Features

- Click the "Harvest" button to collect olives
- Watch the progress bar fill up over 3 seconds
- Button is disabled while harvesting
- Your olive count increases by 1 after each harvest

## Git Setup

```bash
git init
git add .
git commit -m "Initial commit: Olives idle game"
```

To push to GitHub:
```bash
git remote add origin <your-github-repo-url>
git branch -M main
git push -u origin main
```
