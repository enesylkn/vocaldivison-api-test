from flask import Flask, request, jsonify, send_from_directory, Response
from flask_cors import CORS
import os
import subprocess
import threading
import re
import time

# ======================
# Configuration
# ======================
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
UPLOAD_FOLDER = os.path.join(BASE_DIR, "uploads")
SEPARATED_BASE = os.path.join(BASE_DIR, "separated")

MODEL_NAME = "mdx_extra_q"
OUTPUT_BASE = os.path.join(SEPARATED_BASE, MODEL_NAME)

os.makedirs(UPLOAD_FOLDER, exist_ok=True)
os.makedirs(OUTPUT_BASE, exist_ok=True)

app = Flask(__name__)
CORS(app)

current_progress = 0
last_output_folder = None


def run_demucs(command):
    global current_progress
    current_progress = 0

    process = subprocess.Popen(
        command,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        text=True,
        shell=True
    )

    for line in process.stdout:
        print(line.strip())
        match = re.search(r"(\d+)%", line)
        if match:
            current_progress = int(match.group(1))

    process.wait()
    current_progress = 100


@app.route("/separate", methods=["POST"])
def separate_audio():
    global current_progress, last_output_folder

    if "audio" not in request.files:
        return jsonify({
            "success": False,
            "error": "No audio file was provided."
        }), 400

    file = request.files["audio"]

    safe_filename = "".join(
        [c for c in file.filename if c.isalnum() or c in ('.', '_')]
    ).replace(" ", "_")

    input_path = os.path.join(UPLOAD_FOLDER, safe_filename)
    file.save(input_path)

    current_progress = 0

    command = [
        "python", "-m", "demucs.separate",
        "-n", MODEL_NAME,
        "--two-stems=vocals",
        "-d", "cpu",
        "--out", SEPARATED_BASE,
        input_path
    ]

    threading.Thread(target=run_demucs, args=(command,), daemon=True).start()

    # Detect the actual output folder created by Demucs
    time.sleep(1)

    folders = [
        f for f in os.listdir(OUTPUT_BASE)
        if os.path.isdir(os.path.join(OUTPUT_BASE, f))
    ]

    if not folders:
        return jsonify({
            "success": False,
            "error": "Output directory could not be detected."
        }), 500

    folders.sort(
        key=lambda x: os.path.getmtime(os.path.join(OUTPUT_BASE, x)),
        reverse=True
    )

    last_output_folder = folders[0]

    return jsonify({
        "success": True,
        "vocals": f"/download/{last_output_folder}/vocals.wav",
        "instrumental": f"/download/{last_output_folder}/no_vocals.wav"
    })


@app.route("/progress")
def progress():
    def generate():
        last = -1
        while True:
            global current_progress
            if current_progress != last:
                yield f"data:{current_progress}\n\n"
                last = current_progress
            if current_progress >= 100:
                break
            time.sleep(0.5)

    return Response(generate(), mimetype="text/event-stream")


@app.route("/download/<song>/<filename>")
def download_file(song, filename):
    target_dir = os.path.join(OUTPUT_BASE, song)

    if not os.path.exists(target_dir):
        return (
            f"Requested file is not available yet. "
            f"Expected directory was not found: {target_dir}",
            404
        )

    return send_from_directory(target_dir, filename, as_attachment=True)


if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    app.run(host="0.0.0.0", port=port, debug=True)
