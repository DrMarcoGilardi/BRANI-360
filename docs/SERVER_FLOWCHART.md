## Server Architecture Overview

```mermaid
flowchart TD
    subgraph Boot [Boot & Initialization]
        ServerJS[server.js / startServer]
    end

    subgraph Network [Client Interface]
        SC[SocketController]
    end

    subgraph Core [Framework Orchestration]
        PS[PipelineService]
        GPU[GPUResourceManager]
        CM[CacheManager]
        LM[LogManager]
    end

    subgraph AI [AI Engine & Strategies]
        AIE[AIEngine]
        ISP[ImageSourceProvider]
        CP[ContextProvider]
        VP[VisionProvider]
        AP[AudioProvider]
    end

    subgraph External [External APIs & Hardware]
        VLM[LM Studio / Local VLM]
        PyVision[vision_adapter.py]
        AudioAPI[Stable Audio / Gradio]
        PyAudio[audio_adapter.py]
        Maps[Mapillary / MapLibre Maps]
        Geo[Geoapify]
    end

    %% Initialization Flow
    ServerJS -->|Instantiates| CM
    ServerJS -->|Instantiates| GPU
    ServerJS -->|Instantiates| LM
    ServerJS -->|Instantiates| AIE
    ServerJS -->|Instantiates| PS
    ServerJS -->|Instantiates| SC

    %% Client Interaction
    Client((Web Client)) <-->|WebSockets| SC
    SC -->|spatial_sync, cancel, regen| PS

    %% Pipeline Orchestration
    PS -->|Records sessions and errors| LM
    PS -->|Checks DB and Saves Audio| CM
    PS -->|1. process and getTasks| AIE
    PS -->|2. queueBackgroundTask| GPU
    
    %% GPU Worker Execution
    GPU -->|Pops queue and runs| AIE

    %% AI Engine Delegation (Strategy Pattern)
    AIE -->|resolve| CP
    AIE -->|getImage| ISP
    AIE -->|analyse| VP
    AIE -->|generateAudio| AP

    %% Concrete Strategies to External
    CP -.->|HTTP Fetches| Geo
    ISP -.->|HTTP Fetches| Maps
    VP -.->|HTTP POST| VLM
    VP -.->|Spawns Subprocess| PyVision
    AP -.->|WebSockets| AudioAPI
    AP -.->|Spawns Subprocess| PyAudio

    %% Styling
    classDef boot fill:#6c5ce7,stroke:#a29bfe,stroke-width:2px,color:#fff;
    classDef network fill:#00b894,stroke:#55efc4,stroke-width:2px,color:#fff;
    classDef core fill:#2d3436,stroke:#74b9ff,stroke-width:2px,color:#fff;
    classDef ai fill:#0984e3,stroke:#00cec9,stroke-width:2px,color:#fff;
    classDef external fill:#d63031,stroke:#ff7675,stroke-width:2px,color:#fff;
    
    class ServerJS boot;
    class SC network;
    class PS,GPU,CM,LM core;
    class AIE,ISP,CP,VP,AP ai;
    class VLM,PyVision,AudioAPI,PyAudio,Maps,Geo external;