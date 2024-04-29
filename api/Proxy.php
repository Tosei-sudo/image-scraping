<?php

// not print warning
error_reporting(E_ERROR | E_PARSE);

try {
    $url = $_GET['url'];

    if(isset($_GET['referer'])){
        $referer = $_GET['referer'];
    }else{
        $referer = null;
    }

    $ch = curl_init(); // はじめ

    //オプション
    curl_setopt($ch, CURLOPT_URL, $url);
    curl_setopt($ch, CURLOPT_HEADER, true);

    // header
    $headers = array(
        'User-Agent: Mozilla/5.0 (Windows NT 6.1; WOW64; rv:54.0) Gecko/20100101 Firefox/54.0',
        "Accept: text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
        "Connection: keep-alive",
        "Upgrade-Insecure-Requests: 1",
        "Accept-Encoding: gzip, deflate",
        "Accept-Language: ja,en-US;q=0.7,en;q=0.3",
    );

    // リファラー
    if($referer != null){
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, false);
        $headers[] = "Referer: ".$referer;
    }else{
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_TIMEOUT, 30);
    }
    curl_setopt($ch, CURLOPT_HTTPHEADER, $headers);

    $response =  curl_exec($ch);

    // copy header
    $header_size = curl_getinfo($ch, CURLINFO_HEADER_SIZE);
    $headers = substr($response, 0, $header_size);
    $body = substr($response, $header_size);

    $lines = explode("\n", $headers);
    foreach ($lines as $line) {
        header($line);
    }

    curl_close($ch); //終了
    if ($response === false) {
        // response code 500
        http_response_code(500);
        // print curl headers infomation
        echo curl_getinfo($ch);
    } else {
        // if(str_starts_with($body, "HTTP/1.1")){
        //     // export text file
            
        // }
        
        // export text file
        
        
        echo $body;
    }
} catch (\Throwable $th) {
    http_response_code(500);
}
