<?php

try {
    function generateRandomString($len)
    {
        // return random $len char string

        $str1 = chr(mt_rand(97, 122));
        for ($i = 0; $i < $len; $i++) {
            $str1 .= chr(mt_rand(97, 122));
        }

        return $str1;
    }

    // projectCode ais random 16 char string
    // generate projectCode
    $projectCode = generateRandomString(16);

    // make dir to ./Image/{projectCode} 
    mkdir("./Image/" . $projectCode);

    // return projectCode
    header("Content-Type: application/json; charset=utf-8");

    echo $projectCode;
} catch (\Throwable $th) {
    http_response_code(500);
}
