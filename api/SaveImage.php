<?php

try {
    http_response_code(200);

    $image = $_FILES['image'];
    $projectCode = $_POST['projectCode'];
    $fileName = $_POST['fileName'];

    // image to binary
    // save to ./Image/{projectCode}/{fileName} from binary
    move_uploaded_file($image['tmp_name'], "./Image/" . $projectCode . "/" . $fileName);

    header("Content-Type: image/jpeg");
} catch (\Throwable $th) {
    http_response_code(500);
}
