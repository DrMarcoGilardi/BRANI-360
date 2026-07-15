# BRANI-360: An Agnostic Browser-Based Research Sandbox Architecture for AI Audio Generation on Networks of 360° Images
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
# BRANI-360 is dual-licensed. The above AGPLv3 license applies to open-source 
# and academic research use. If you wish to integrate this software into a 
# closed-source or commercial application, you must obtain a proprietary 
# commercial license. 
# 
# Please contact Marco.Gilardi@uws.ac.uk for commercial licensing details.
# -------------------------------------------------------------------------

"""
MOCK Vision Adapter Script - EXAMPLE ONLY
Acts as an external Python process for the Node.js AI Engine.
Ingests a target image and location context to produce structural audio generation intents 
(e.g., persistent ambient washes and transient 3D spatial objects) using a Vision-Language Model.
"""

import argparse
import sys
import json

def analyze_image(image_path, context, options):
    """
    Analyzes a localized image to extract sonic intents based on requested semantic layers.

    Args:
        image_path (str): The file system path to the temporary image buffer.
        context (str): The physical location string (e.g., 'Paris, France') used to ground the prompt.
        options (dict): Execution options containing 'requestedLayers' (list) and 'isAnchor' (bool) flags.

    Returns:
        list[dict]: A list of intent dictionaries describing the audio to be generated. 
                    Includes semantic labels, textual prompts, positional data (h, p, dist), 
                    and engine event mapping.
    """

    # Mock ML Logic. 
    # Replace this with actual code.

    requested_layers = options.get("requestedLayers", ["spatial"])
    is_anchor = options.get("isAnchor", False)
    
    intents = []

    # Horizon / Background Wash (Only if requested and is an anchor)
    if "horizon" in requested_layers and is_anchor:
        intents.append({
            "layer": "horizon",
            "label": "Environment",
            "prompt": f"natural acoustics, recorded at {context}, realistic clean field recording",
            "type": "ambient",
            "eventName": "node_ready",
            "identity": "node",
            "persistent": True,
            "positional": False,
            "envType": "nature" # E.g., nature, city, suburban
        })

    # Spatial Objects (Point sources with 3D coordinates)
    if "spatial" in requested_layers:
        intents.append({
            "layer": "spatial",
            "label": "Pedestrian, footsteps, dry",
            "prompt": f"Pedestrian footsteps, recorded at {context}, clear distinct point-source",
            "type": "object_human", # object_human, object_mechanical, object_organic
            "eventName": "instance_ready",
            "identity": "instance",
            "persistent": False,
            "positional": True,
            "envType": "human",
            "h": 45,    # Azimuth (Heading)
            "p": 0,     # Elevation (Pitch)
            "dist": 5.0 # Distance
        })

    return intents

if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument('--image', required=True, help="Path to input image file")
    parser.add_argument('--context', required=True, help="Location string")
    parser.add_argument('--options', required=True, help="JSON string of options")
    args = parser.parse_args()

    try:
        options = json.loads(args.options)
        
        # Run the ML Analysis
        intents = analyze_image(args.image, args.context, options)
        
        # Prepare final output object
        output = {"intents": intents}

        # IMPORTANT: Print ONLY the JSON to stdout for Node to read
        print(json.dumps(output))
        sys.exit(0)

    except Exception as e:
        # Print errors to stderr so Node's stdout parsing doesn't break
        print(f"Error in vision adapter: {str(e)}", file=sys.stderr)
        sys.exit(1)