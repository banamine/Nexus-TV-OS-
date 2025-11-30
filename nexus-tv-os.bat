@echo off
REM NEXUS TV OS - Windows Batch Launcher
REM Drop playlist file on this script to extract

if "%1"=="" (
    echo.
    echo ========================================
    echo NEXUS TV OS - Playlist Extractor
    echo ========================================
    echo.
    echo USAGE: Drag and drop a playlist file onto this script
    echo.
    echo Supported formats:
    echo   .m3u, .m3u8 - M3U playlists
    echo   .csv - CSV format
    echo   .txt - Text files with URLs
    echo   .json - JSON format
    echo.
    echo OUTPUT: Files saved to 'output' folder
    echo   - extracted.json - All items
    echo   - standalone/ - HTML player pages
    echo.
    pause
) else (
    python nexus-tv-os.py "%1"
    pause
)
