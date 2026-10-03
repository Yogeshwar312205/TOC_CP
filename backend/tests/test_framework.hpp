// ─────────────────────────────────────────────────────────────────────────────
// AutomataLab — Lightweight test framework
// No external dependencies — just C++ STL
// ─────────────────────────────────────────────────────────────────────────────
#pragma once
#include <iostream>
#include <string>
#include <functional>
#include <vector>
#include <set>
#include <utility>

template <typename T>
inline std::ostream& operator<<(std::ostream& os, const std::set<T>& s) {
    os << "{";
    bool first = true;
    for (const auto& item : s) {
        if (!first) os << ", ";
        os << item;
        first = false;
    }
    return os << "}";
}

template <typename T, typename U>
inline std::ostream& operator<<(std::ostream& os, const std::pair<T, U>& p) {
    return os << "(" << p.first << ", " << p.second << ")";
}

struct TestCase {
    std::string name;
    std::function<void()> fn;
};

inline std::vector<TestCase>& getRegisteredTests() {
    static std::vector<TestCase> tests;
    return tests;
}

static int g_passed = 0;
static int g_failed = 0;

#define TEST(name) \
    static void test_##name(); \
    static bool _reg_##name = (getRegisteredTests().push_back({#name, test_##name}), true); \
    static void test_##name()

#define ASSERT_TRUE(expr) \
    do { \
        if (!(expr)) { \
            std::cerr << "  FAIL: " << #expr << " (line " << __LINE__ << ")\n"; \
            throw std::runtime_error("assertion failed"); \
        } \
    } while(0)

#define ASSERT_EQ(a, b) \
    do { \
        if ((a) != (b)) { \
            std::cerr << "  FAIL: " << #a << " == " << #b \
                      << "  [got: " << (a) << " vs " << (b) << "] (line " << __LINE__ << ")\n"; \
            throw std::runtime_error("assertion failed"); \
        } \
    } while(0)

#define ASSERT_FALSE(expr) ASSERT_TRUE(!(expr))

inline int runAllTests() {
    auto& tests = getRegisteredTests();
    for (auto& tc : tests) {
        std::cout << "[ RUN  ] " << tc.name << "\n";
        try {
            tc.fn();
            std::cout << "[ PASS ] " << tc.name << "\n";
            ++g_passed;
        } catch (const std::exception& ex) {
            std::cerr << "[ FAIL ] " << tc.name << " — " << ex.what() << "\n";
            ++g_failed;
        }
    }
    std::cout << "\n=== " << g_passed << " passed, " << g_failed << " failed ===\n";
    return g_failed == 0 ? 0 : 1;
}
