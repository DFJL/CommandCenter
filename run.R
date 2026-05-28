#!/usr/bin/env Rscript
# Launch Clinical Delivery Command Center
shiny::runApp(".", host = "0.0.0.0", port = 3838, launch.browser = FALSE)
