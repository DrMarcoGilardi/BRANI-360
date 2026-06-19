# ABBA-360: An Agnostic Browser-Based Research Sandbox Architecture for AI Audio Generation on Networks of 360° Images
# Copyright (C) 2026 Dr Marco Gilardi, University of the West of Scotland.
# 
# This program is free software: you can redistribute it and/or modify
# it under the terms of the GNU Affero General Public License as published
# by the Free Software Foundation, either version 3 of the License, or
# (at your option) any later version.
# 
# This program is distributed in the hope that it will be useful,
# but WITHOUT ANY WARRANTY; without even the implied warranty of
# MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
# GNU Affero General Public License for more details.
# 
# You should have received a copy of the GNU Affero General Public License
# along with this program.  If not, see <https://www.gnu.org/licenses/>.
# 
# -------------------------------------------------------------------------
# COMMERCIAL LICENSING
# ABBA-360 is dual-licensed. The above AGPLv3 license applies to open-source 
# and academic research use. If you wish to integrate this software into a 
# closed-source or commercial application, you must obtain a proprietary 
# commercial license. 
# 
# Please contact Marco.Gilardi@uws.ac.uk for commercial licensing details.
# -------------------------------------------------------------------------

"""
MOCK Audio Adapter Script --- EXAMPLE ONLY
Acts as an external Python delegate for the Node.js AI Engine to synthesize audio.
Handles prompt decoding, audio-to-audio feedback pipelines, diffusion-style progress reporting, 
and saving the final `.wav` file to the host system.
"""
import argparse
import sys
import json
import time

def generate_audio(task, output_path):
    """
    Executes the audio synthesis pipeline based on the provided task intent and saves the output to disk.
    Simulates or wraps a machine learning generation loop (e.g., PyTorch inference) and streams 
    progress formatted as 'PROGRESS: X/Y' to stdout for the Node.js orchestrator to intercept.

    Args:
        task (dict): The complete intent configuration. Includes the target 'prompt', 'type' 
                     (e.g., 'ambient', 'object_human'), and 'regenOpts' for human-in-the-loop modifications.
        output_path (str): The destination file path where the resulting .wav file will be written.
    """
    prompt = task.get("prompt", "")
    audio_type = task.get("type", "ambient")
    regen_opts = task.get("regenOpts", {})

    # Determine generation parameters based on regenOpts
    if regen_opts and regen_opts.get("useInit") and regen_opts.get("path"):
        init_audio_path = regen_opts.get("path")
        feedback = regen_opts.get("feedback", "No feedback provided")
        noise_level = regen_opts.get("noiseLevel", 0.1)
        
        # print to stderr so it doesn't break Node's progress parsing
        print(f"Applying img2img style generation. Initial audio: {init_audio_path}, Noise: {noise_level}", file=sys.stderr)
        prompt = f"{prompt}, adjusted for: {feedback}"

    # Simulate an ML Generation Loop (e.g., Diffusion Steps)
    total_steps = 25
    for step in range(1, total_steps + 1):
        # ... Run PyTorch inference step ...
        time.sleep(0.05) 
        
        # IMPORTANT: Print progress strictly in X/Y format to stdout
        # Node.js regex specifically looks for "PROGRESS: X/Y"
        print(f"PROGRESS: {step}/{total_steps}", flush=True)

    # Save the final file
    # Replace this with: torchaudio.save(output_path, waveform, sample_rate)
    with open(output_path, "wb") as f:
        # Writing a tiny, valid RIFF WAV header for testing purposes
        f.write(b"RIFF$\x00\x00\x00WAVEfmt \x10\x00\x00\x00\x01\x00\x01\x00D\xac\x00\x00\x88X\x01\x00\x02\x00\x10\x00data\x00\x00\x00\x00")

if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument('--task', required=True, help="JSON string of the complete task object")
    parser.add_argument('--output', required=True, help="Path to save the final .wav file")
    args = parser.parse_args()

    try:
        task_data = json.loads(args.task)
        
        # Run generation and save to the requested output path
        generate_audio(task_data, args.output)
        
        sys.exit(0)

    except Exception as e:
        print(f"Error in audio adapter: {str(e)}", file=sys.stderr)
        sys.exit(1)