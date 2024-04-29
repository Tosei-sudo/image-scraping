<?php

try {

    // del dir and zip

    $projectCode = $_GET['projectCode'];

    $dir_path = "./Image";
    $zip_path =  "./zips";

    // ファイルが存在しない場合、処理終了
    // if (!file_exists($dir_path)) {
    //     http_response_code(404);
    //     exit();
    // }

    rmdir_recursively($dir_path);
    rmdir_recursively($zip_path);
} catch (\Throwable $th) {
    http_response_code(500);
}

function rmdir_recursively($dir)
{
    $dh = opendir($dir);
    if ($dh === false) {
        throw new Exception("Failed to open $dir");
    }

    while (true) {
        $file = readdir($dh);
        if ($file === false) {
            break;
        }
        if ($file === '.' || $file === '..') {
            continue;
        }

        $path = rtrim($dir, '/') . '/' . $file;
        if (is_dir($path)) {
            rmdir_recursively($path);
        } else {
            unlink($path);
        }
    }
    closedir($dh);
}
