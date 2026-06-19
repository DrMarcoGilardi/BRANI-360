## Client Architecture Overview

```mermaid
flowchart TD
    subgraph Boot [Dependency Injection Root]
        ClientJS[client.js / bootstrap]
    end

    subgraph Core [Core Orchestration]
        NM[NavigationManager]
        NS[NetworkService]
        TR[TopologyRadar]
        AT[AcousticTreadmill]
        SC[SceneController]
        SAP[SpatialAudioPlayer]
        UI[UIManager]
    end

    subgraph Strategies [Strategy Interfaces]
        VP[ViewerProvider]
        TP[TopologyProvider]
        SP[SemanticProvider]
        VRL[VRLoaderProvider]
        NSS[NodeSelectionStrategy]
    end

    %% DI Flow (client.js)
    ClientJS -->|Instantiates| UI
    ClientJS -->|Instantiates| SAP
    ClientJS -->|Instantiates| AT
    ClientJS -->|Instantiates| TR
    ClientJS -->|Instantiates| SC
    ClientJS -->|Instantiates| NM
    ClientJS -->|Instantiates| NS

    %% Strategy Injection
    ClientJS -.->|Dynamically Imports & Injects| VP
    ClientJS -.->|Dynamically Imports & Injects| TP
    ClientJS -.->|Dynamically Imports & Injects| SP
    ClientJS -.->|Dynamically Imports & Injects| VRL
    ClientJS -.->|Dynamically Imports & Injects| NSS

    %% NavigationManager (Central Hub)
    NM -->|Listens & Gets Location| VP
    NM -->|Queries Graph & Anchors| TR
    NM -->|Emits Sync Payload| NS
    NM -->|Updates Node Info & Radar| UI
    NM -->|Sets Sync State| SAP
    NM -->|Resets & Refreshes Mix| AT
    NM -->|Updates VR & Skybox| SC
    NM -->|Queries Active Layers| SP

    %% NetworkService (Socket Callbacks)
    NS <-->|WebSockets| Server((Server Tunnel))
    NS -->|Updates Progress HUD| UI
    NS -->|Plays Object / Registers Persistent| SAP
    NS -->|Adds Spatial Source / Ambient Wash| SC
    NS -->|Updates Aggregate Progress| AT
    NS -->|Reads Current Node ID| NM

    %% TopologyRadar Internal
    TR -->|_getNode| TP
    TR -->|isAnchorNode| NSS

    %% SceneController Internal
    SC -->|getLowResBase / stitchProgressively| VRL

    %% Styling
    classDef boot fill:#6c5ce7,stroke:#a29bfe,stroke-width:2px,color:#fff;
    classDef core fill:#2d3436,stroke:#74b9ff,stroke-width:2px,color:#fff;
    classDef strategy fill:#0984e3,stroke:#00cec9,stroke-width:2px,color:#fff;
    
    class ClientJS boot;
    class NM,NS,TR,AT,SC,SAP,UI core;
    class VP,TP,SP,VRL,NSS strategy;