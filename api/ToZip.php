
<?php
// 設定ファイルの読み込み

try {
    $projectCode = $_GET['projectCode'];

    $file_path = "./Image/" . $projectCode . "/";
    $zip_path =  "./zips/" . $projectCode . ".zip";

    // ファイルが存在しない場合、処理終了
    if (!file_exists($file_path)) {
        http_response_code(404);
        exit();
    }
    // zip圧縮
    $zip = new ZipArchive;
    if ($zip->open($zip_path, ZipArchive::CREATE) === TRUE) {
        foreach (glob($file_path . "*") as $file) {
            $zip->addFile($file, basename($file));
        }
        $zip->close();
        echo "/image-scraping/api/zips/" . $projectCode . ".zip";
    } else {
        http_response_code(500);
    }
} catch (\Throwable $th) {
    http_response_code(500);
}

?>