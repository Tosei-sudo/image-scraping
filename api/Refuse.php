<?php

try {

    // del dir and zip

    $projectCode = $_GET['projectCode'];

    $dir_path = "./Image/" . $projectCode . "/";
    $zip_path =  "./zips/" . $projectCode . ".zip";

    // ファイルが存在しない場合、処理終了
    if (!file_exists($dir_path)) {
        http_response_code(404);
        exit();
    }

    // delete
    $files = glob($dir_path . "*");
    foreach ($files as $file) {
        unlink($file);
    }

    rmdir($dir_path);

    unlink($zip_path);
} catch (\Throwable $th) {
    http_response_code(500);
}
