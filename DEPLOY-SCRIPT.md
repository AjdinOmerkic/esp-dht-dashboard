# Deploy the updated Apps Script (fix "Missing parameters")

The dashboard calls your script with **no parameters** (`.../exec`) or `?action=read`. If you still see "Missing parameters", the **old** script is running. Do this:

## 1. Open your Apps Script project

- Open the Google Sheet that stores the sensor data.
- **Extensions → Apps Script** (or go to script.google.com and open the project bound to that sheet).

## 2. Replace the code

- Delete everything in the editor.
- Open **`apps-script-doGet.gs`** in this repo and copy its **entire** content.
- Paste into the Apps Script editor and **Save** (Ctrl+S).

## 3. Create a new deployment (required)

- **Deploy → Manage deployments**.
- Click the **pencil (Edit)** on the current deployment.
- Under **Version**, choose **New version** (e.g. "Read support").
- Click **Deploy**.
- Leave the **Web app URL** as is (don’t change the dashboard URL).

If you don’t create a **new version**, the old script keeps running and you’ll keep getting "Missing parameters".

## 4. Test

- In the browser, open:  
  `https://script.google.com/macros/s/.../exec`  
  (your full exec URL with **nothing** after `exec`).
- You should see JSON like `[{"Timestamp":"...","Temperature":25,"Humidity":60},...]`, not "Missing parameters".
- Reload the dashboard; it should load data.

## Summary

| Step              | Action                                      |
|-------------------|---------------------------------------------|
| Replace code     | Paste full `apps-script-doGet.gs` and Save  |
| New deployment   | Deploy → Manage deployments → Edit → New version → Deploy |
| Test             | Open .../exec in browser → expect JSON      |
