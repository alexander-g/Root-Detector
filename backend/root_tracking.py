import os
import torch, torchvision
import numpy as np
import scipy.ndimage
import cloudpickle
import PIL.Image


import backend
from backend import GLOBALS



def process(filename0, filename1, corrections=None, points0=None, points1=None):
    print(f'Performing root tracking on files {filename0} and {filename1}')
    modelfile  = os.path.join('models/root_tracking_models', GLOBALS.tracking_active_model+'.cpkl')
    matchmodel = cloudpickle.load(open(modelfile, 'rb'))

    seg0f = f'{filename0}.segmentation.png'
    seg1f = f'{filename1}.segmentation.png'

    if not os.path.exists(seg0f) or not os.path.exists(seg1f):
        img0    = torchvision.transforms.ToTensor()(PIL.Image.open(filename0))
        img1    = torchvision.transforms.ToTensor()(PIL.Image.open(filename1))
        with GLOBALS.processing_lock:
            seg0    = run_segmentation(filename0)
            seg1    = run_segmentation(filename1)
        PIL.Image.fromarray( (seg0*255).astype('uint8') ).save( seg0f )
        PIL.Image.fromarray( (seg1*255).astype('uint8') ).save( seg1f )
    else:
        seg0   = PIL.Image.open(seg0f) / np.float32(255)
        seg1   = PIL.Image.open(seg1f) / np.float32(255)
    
    if corrections is None:  #FIXME: better condition?
        img0    = torchvision.transforms.ToTensor()(PIL.Image.open(filename0))
        img1    = torchvision.transforms.ToTensor()(PIL.Image.open(filename1))
        with GLOBALS.processing_lock:
            output  = matchmodel.bruteforce_match(img0, img1, seg0, seg1, matchmodel, n=5000, cyclic_threshold=4, dev='cpu') #TODO: larger n
            print()
            print(len(output['points0']))
            print('Matched percentage:', output['matched_percentage'])
            print()
            imap    = matchmodel.interpolation_map(output['points0'], output['points1'], img0.shape[-2:])
    else:
        output = {'points0':np.asarray(points0), 'points1':np.asarray(points1)}
        corrections    = np.array(corrections).reshape(-1,4)
        if len(corrections)>0:
            imap   = np.load(f'{filename0}.{os.path.basename(filename1)}.imap.npy').astype('float32')
            corrections_p1 = corrections[:,:2][:,::-1] #xy to yx
            corrections_p0 = corrections[:,2:][:,::-1]
            corrections_p1 = np.stack([
                scipy.ndimage.map_coordinates(imap[...,0], corrections_p1.T, order=1),
                scipy.ndimage.map_coordinates(imap[...,1], corrections_p1.T, order=1),
            ], axis=-1)
            output['points0'] = np.concatenate([points0, corrections_p0])
            output['points1'] = np.concatenate([points1, corrections_p1])
        imap    = matchmodel.interpolation_map(output['points0'], output['points1'], seg0.shape)
    
    np.save(f'{filename0}.{os.path.basename(filename1)}.imap.npy', imap.astype('float16'))  #f16 to save space & time

    warped_seg1 = matchmodel.warp(seg1, imap)
    gmap        = matchmodel.create_growth_map_rgba( seg0>0.5,  warped_seg1>0.5 )
    output_file = f'{filename0}.{os.path.basename(filename1)}.growthmap.png'
    PIL.Image.fromarray(gmap).convert('RGB').save( output_file )
    output['growthmap'] = output_file

    output_file = f'{filename0}.{os.path.basename(filename1)}.growthmap_rgba.png'
    PIL.Image.fromarray(gmap).save( output_file )
    output['growthmap_rgba'] = output_file
    output['segmentation0']  = seg0f
    output['segmentation1']  = seg1f

    return output


def run_segmentation(imgfile):
    return backend.call_with_optional_kwargs(GLOBALS.model.process_image, imgfile, threshold=None)
