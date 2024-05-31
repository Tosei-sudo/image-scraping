<?php

function sendMessage($msg){

    $iniFile = "./env.ini";
    $ini = parse_ini_file($iniFile);

    $WEBHOOK_URL = $ini['WEBHOOK_URL'];

    $data = array(
        'text' => $msg
    );

    $data_string = json_encode($data);

    $ch = curl_init($WEBHOOK_URL);
    curl_setopt($ch, CURLOPT_CUSTOMREQUEST, "POST");
    curl_setopt($ch, CURLOPT_POSTFIELDS, $data_string);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_HTTPHEADER, array(
        'Content-Type: application/json',
        'Content-Length: ' . strlen($data_string))
    );

    $result = curl_exec($ch);
    return $result;
}
