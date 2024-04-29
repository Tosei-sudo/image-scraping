<?php
require_once '../vendor/autoload.php';

use PhpOffice\PhpPresentation\PhpPresentation;
use PhpOffice\PhpPresentation\IOFactory;
use PhpOffice\PhpPresentation\DocumentLayout;

try {


    $projectCode = $_GET['projectCode'];

    $file_path = "./Image/" . $projectCode . "/";


    //新規プレゼンテーション作成
    $phpPres = new PhpPresentation();

    //ドキュメントのプロパティ設定
    $phpPres->getDocumentProperties()
        ->setCreator('Image Scrapper');

    // set size A4(210mm x 297mm)
    $phpPres->getLayout()->setDocumentLayout(['cx' => 10692000, 'cy' => 7560000], true);

    $slideWidth = $phpPres->getLayout()->getCX(DocumentLayout::UNIT_PIXEL);
    $slideHeight = $phpPres->getLayout()->getCY(DocumentLayout::UNIT_PIXEL);

    //図形(テキスト)追加
    foreach (glob($file_path . "*") as $file) {
        $image_size = getimagesize($file);
        $aspect_ratio = $image_size[0] / $image_size[1];
        // add slide
        $slide = $phpPres->createSlide();

        // insert image from file
        $shape = $slide->createDrawingShape();
        $shape->setName('Image')
            ->setDescription('Image')
            ->setPath($file)
            ->setOffsetX(0)
            ->setOffsetY(0);

        // set image size
        // 最大幅で合わせるが、高さがスライドを超える場合は高さで合わせる
        if ($aspect_ratio > $slideWidth / $slideHeight) {
            $shape->setWidth($slideWidth);
            $shape->setHeight($slideWidth / $aspect_ratio);
        } else {
            $shape->setWidth($slideHeight * $aspect_ratio);
            $shape->setHeight($slideHeight);
        }
    }
    // 1枚目のスライドを削除
    $phpPres->removeSlideByIndex(0);

    //ファイルダウンロード
    //MIMEタイプ：https://technet.microsoft.com/ja-jp/ee309278.aspx
    header('Content-Description: File Transfer');
    header('Content-Disposition: attachment; filename*=utf-8\'\'' . rawurlencode($projectCode . '.pptx'));
    header('Content-Type: application/vnd.openxmlformats-officedocument.presentationml.presentation');
    header('Content-Transfer-Encoding: binary');
    header('Cache-Control: must-revalidate, post-check=0, pre-check=0');
    header('Expires: 0');
    $xmlWriter = IOFactory::createWriter($phpPres, 'PowerPoint2007');
    ob_end_clean(); //バッファ消去
    $xmlWriter->save('php://output');
} catch (\Throwable $th) {
    //throw $th;
    http_response_code(500);
}
