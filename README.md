# Workout Tracker

A responsive HTML/CSS/JavaScript version of the WorkoutTracker iOS app.

## Run it

From this folder, start a local web server:

```bash
python3 -m http.server 8080
```

Then open [http://localhost:8080](http://localhost:8080).

Keep using the same address and browser profile so the browser can find the same saved data.

## Data and automatic saving

- The first launch includes the exercise catalogue with an empty workout and body-weight history.
- Every set, rep, weight, new exercise, and body-weight change is written immediately to browser `localStorage`.
