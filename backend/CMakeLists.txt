cmake_minimum_required(VERSION 3.15)
project(AutomataLab LANGUAGES CXX)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_CXX_EXTENSIONS OFF)

if(CMAKE_CXX_COMPILER_ID STREQUAL "GNU")
    add_compile_options(-std=gnu++1z)
endif()

include(FetchContent)

# ── 1. Asio (standalone, no Boost) ──────────────────────────────────────────
FetchContent_Declare(
    asio
    GIT_REPOSITORY https://github.com/chriskohlhoff/asio.git
    GIT_TAG        asio-1-34-2
    GIT_SHALLOW    TRUE
)
FetchContent_MakeAvailable(asio)

set(ASIO_INCLUDE_DIR "${asio_SOURCE_DIR}/asio/include" CACHE PATH "Asio include dir" FORCE)
include_directories(${ASIO_INCLUDE_DIR})

# Create an interface target for Asio so we can link it cleanly
add_library(asio_lib INTERFACE)
target_include_directories(asio_lib INTERFACE ${ASIO_INCLUDE_DIR})
target_compile_definitions(asio_lib INTERFACE ASIO_STANDALONE)

# ── 2. Crow ──────────────────────────────────────────────────────────────────
set(CROW_BUILD_EXAMPLES OFF CACHE BOOL "" FORCE)
set(CROW_BUILD_TESTS    OFF CACHE BOOL "" FORCE)
set(CROW_USE_BOOST      OFF CACHE BOOL "" FORCE)
set(CROW_FEATURES_ASIO  ON  CACHE BOOL "" FORCE)
set(ASIO_FOUND          ON  CACHE BOOL "" FORCE)

FetchContent_Declare(
    crow
    GIT_REPOSITORY https://github.com/CrowCpp/Crow.git
    GIT_TAG        v1.3.0
    GIT_SHALLOW    TRUE
)
FetchContent_MakeAvailable(crow)

# ── 3. nlohmann/json ─────────────────────────────────────────────────────────
FetchContent_Declare(
    json
    GIT_REPOSITORY https://github.com/nlohmann/json.git
    GIT_TAG        v3.11.3
    GIT_SHALLOW    TRUE
)
set(JSON_BuildTests OFF CACHE BOOL "" FORCE)
FetchContent_MakeAvailable(json)

# ── 4. AutomataEngine — pure algorithm static library (no Crow) ──────────────
add_library(AutomataEngine STATIC
    src/Conversion.cpp
    src/Minimization.cpp
    src/Simulator.cpp
    src/Validation.cpp
)
target_include_directories(AutomataEngine PUBLIC include)
target_link_libraries(AutomataEngine PUBLIC nlohmann_json::nlohmann_json)
target_compile_definitions(AutomataEngine PUBLIC ASIO_STANDALONE)

if(MSVC)
    target_compile_options(AutomataEngine PRIVATE /W4 /bigobj /EHsc /utf-8)
else()
    target_compile_options(AutomataEngine PRIVATE -Wall -Wextra -Wpedantic)
endif()

# ── 5. Main server executable ─────────────────────────────────────────────────
add_executable(automatalab_server src/main.cpp)
target_link_libraries(automatalab_server PRIVATE
    AutomataEngine
    Crow::Crow
    asio_lib
    nlohmann_json::nlohmann_json
)
target_compile_definitions(automatalab_server PRIVATE ASIO_STANDALONE)

if(MSVC)
    target_compile_options(automatalab_server PRIVATE /bigobj /EHsc /utf-8)
    # On Windows, link against ws2_32 for Winsock
    target_link_libraries(automatalab_server PRIVATE ws2_32)
endif()

# ── 6. Test executable ────────────────────────────────────────────────────────
add_executable(automatalab_tests
    tests/test_main.cpp
    tests/test_conversion.cpp
    tests/test_minimization.cpp
    tests/test_simulator.cpp
)
target_link_libraries(automatalab_tests PRIVATE
    AutomataEngine
    nlohmann_json::nlohmann_json
)
target_compile_definitions(automatalab_tests PRIVATE ASIO_STANDALONE)

if(MSVC)
    target_compile_options(automatalab_tests PRIVATE /bigobj /EHsc /utf-8)
endif()

enable_testing()
add_test(NAME AllTests COMMAND automatalab_tests)
