# Set up source and destination
$sourcePath = Get-Location
$zipFile = "$env:TEMP\my-archive.zip"

# Clean up existing zip file if present
if (Test-Path $zipFile) {
    Remove-Item $zipFile
}

Add-Type -AssemblyName 'System.IO.Compression.FileSystem'

function Add-ToZip($zipFile, $sourcePath) {
    $excludedFolders = 'node_modules|\.git|dist|build|\.venv'
    $regex = "[\\/]+($excludedFolders)[\\/]"

    $zip = [System.IO.Compression.ZipFile]::Open($zipFile, 'Update')

    # Walk all files recursively
    [System.IO.Directory]::EnumerateFiles($sourcePath, '*', 'AllDirectories') | ForEach-Object {
        $fullPath = $_
        $relativePath = $fullPath.Substring($sourcePath.Path.Length).TrimStart('\','/')

        # Exclude files in unwanted folders and avoid adding the zip file itself
        if ($fullPath -notmatch $regex -and $fullPath -ne $zipFile) {
            Write-Host "Adding: $relativePath"
            [System.IO.Compression.ZipFileExtensions]::CreateEntryFromFile($zip, $fullPath, $relativePath)
        } else {
            Write-Host "Skipping: $relativePath"
        }
    }

    $zip.Dispose()
}

Add-ToZip -zipFile $zipFile -sourcePath $sourcePath

Write-Host "`n✅ Zip created at: $zipFile"
