# CMake generated Testfile for 
# Source directory: D:/TOC_CP/backend
# Build directory: D:/TOC_CP/backend/build
# 
# This file includes the relevant testing commands required for 
# testing this directory and lists subdirectories to be tested as well.
add_test(AllTests "D:/TOC_CP/backend/build/automatalab_tests.exe")
set_tests_properties(AllTests PROPERTIES  _BACKTRACE_TRIPLES "D:/TOC_CP/backend/CMakeLists.txt;107;add_test;D:/TOC_CP/backend/CMakeLists.txt;0;")
subdirs("_deps/crow-build")
subdirs("_deps/json-build")
