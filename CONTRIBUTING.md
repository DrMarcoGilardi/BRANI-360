Contributing to BRANI-360

First, thank you for your interest in the BRANI-360 research sandbox!

To protect the intellectual property of the core orchestration framework and maintain its specific licensing structure, please read the following strict guidelines before interacting with the repository.

1. No Code Contributions to the Core Engine (Pull Requests Are Closed)

We do not accept external code contributions via Pull Requests for the BRANI-360 core orchestration files. BRANI-360 operates under a dual-licensing model: it is released publicly under the AGPLv3 for open-source and academic research, but is also available under a proprietary license for commercial entities.

To legally offer commercial licenses, the project maintainer must retain 100% of the copyright to the core codebase. This includes core orchestration files such as the PipelineService, NavigationManager, and AcousticTreadmill. Accepting external code from the community introduces copyright fragmentation. To keep things simple and legally sound, all code in this upstream repository is authored and maintained strictly by the original creator.

Any Pull Requests submitted targeting the core engine will be automatically closed.

2. Custom Strategies Belong to You (Host Them Separately)

BRANI-360 is designed as a strictly agnostic orchestration engine utilizing the Strategy Pattern.

If you write a custom implementation, you do not need to submit it to this repository. The system uses dynamic dependency injection, reading your .env file at boot to dynamically import your requested JavaScript classes.

Those custom strategies belong entirely to you. You are encouraged to host them in your own separate repositories. You simply need to place your strategy files in the appropriate directory locally, ensure the class name matches the filename exactly, and activate them via the .env file. The architecture allows you to connect your own image sources, node selection algorithms, models, APIs, or mapping SDKs without editing the core orchestration files.

If you create a great custom strategy and publish it, feel free to open an Issue in this repository to share the link to your repo so other researchers can find it.

3. How You Can Contribute (Issues, Feedback, and Proposals)

While we do not accept direct Pull Requests for the core framework, community feedback is vital to improving the sandbox. Anyone can report bugs, request features, and propose code changes without manual approval of (or payment for) accounts by using GitHub Issues:

Proposing Code Changes: If you have an idea for an improvement or a bug fix, you can propose code changes by opening a GitHub Issue and including your patches or code snippets. If the proposed change is valuable to the broader research community, the maintainer will manually write and implement the logic into the core codebase to ensure copyright consistency.

Bug Reports: If you discover a bug in the core orchestration engine, please open an Issue. Provide detailed steps to reproduce the bug, your .env configuration, and relevant server/client logs.

Research Discussions: Feel free to use the Issues tab to discuss how you are using the sandbox to explore research questions, such as AI hallucination prevention or defining cognitive thresholds in VR.

4. Forking the Repository

You are completely free to fork this repository to build out your local research environments.

Important Licensing Reminder: If you fork the repository, modify the core BRANI-360 engine code, and deploy it over a network (e.g., hosting the Node.js backend to serve users), the AGPLv3 license legally requires you to open-source your modified version under the exact same AGPLv3 terms.

Enjoy experimenting with the sandbox, and please report any core bugs you find via the Issues tab.
